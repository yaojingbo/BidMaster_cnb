import assert from 'node:assert/strict';
import test from 'node:test';
import { getTableConfig } from 'drizzle-orm/pg-core';
import {
  knowledgeBaseFiles,
  knowledgeBaseMembers,
  knowledgeBases,
  ragChunks,
  ragIndexes,
  ragQueryCitations,
  ragVectorOperations,
} from '../src/db/schema.js';

const expectedTables = [
  knowledgeBases,
  knowledgeBaseMembers,
  knowledgeBaseFiles,
  ragIndexes,
  ragChunks,
  ragVectorOperations,
  ragQueryCitations,
];

test('RAG Schema 使用独立表名并包含主索引', () => {
  const tableNames = expectedTables.map((table) => getTableConfig(table).name);
  assert.deepEqual(tableNames, [
    'rag_knowledge_bases',
    'rag_knowledge_base_members',
    'rag_knowledge_base_files',
    'rag_indexes_v3',
    'rag_chunks_v3',
    'rag_vector_operations',
    'rag_query_citations_v3',
  ]);

  assert.ok(getTableConfig(ragIndexes).indexes.some((item) => item.config.name === 'rag_index_identity_uq'));
  assert.ok(getTableConfig(ragVectorOperations).indexes.some((item) => item.config.name === 'rag_vector_outbox_claim_idx'));
});

test('引用融合分数使用双精度浮点数', () => {
  const score = getTableConfig(ragQueryCitations).columns.find((column) => column.name === 'score');
  assert.ok(score);
  assert.equal(score.getSQLType(), 'double precision');
});

test('Neon chunk 事实表不保存向量', () => {
  const columnNames = getTableConfig(ragChunks).columns.map((column) => column.name);
  assert.equal(columnNames.includes('vector'), false);
  assert.ok(columnNames.includes('content'));
  assert.ok(columnNames.includes('content_hash'));
});
