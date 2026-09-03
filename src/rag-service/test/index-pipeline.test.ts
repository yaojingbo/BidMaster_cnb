import assert from 'node:assert/strict';
import test from 'node:test';
import { RagChunker } from '../src/rag-chunker.js';
import { buildChunkId, buildChunkMetadata, collectionName } from '../src/index-pipeline.js';

test('collectionName 派生版本化集合名并清洗非法字符', () => {
  assert.equal(
    collectionName({ RAG_VECTOR_COLLECTION: 'bidmaster_rag_chunks', RAG_INDEX_VERSION: 'v3-text-embedding-v4' }),
    'bidmaster_rag_chunks_v3_text_embedding_v4',
  );
});

test('buildChunkId 生成幂等 id', () => {
  assert.equal(buildChunkId('file-01', 0), 'file-01-0');
  assert.equal(buildChunkId('file-01', 3), 'file-01-3');
});

test('buildChunkMetadata 组装 metadata 且不含向量键', () => {
  const chunks = new RagChunker().chunk('这是招标文件正文内容。');
  const metadata = buildChunkMetadata(chunks[0], {
    fileId: 'file-01',
    userId: 'user-01',
    indexVersion: 'v3-text-embedding-v4',
  });
  assert.equal(metadata.text, '这是招标文件正文内容。');
  assert.equal(metadata.file_id, 'file-01');
  assert.equal(metadata.user_id, 'user-01');
  assert.equal(metadata.index_id, 'file-01');
  assert.equal(metadata.index_version, 'v3-text-embedding-v4');
  assert.equal(metadata.chunk_type, 'text');
  // 关键：metadata 不得含 vector/chunk_id 键（避免覆盖向量或主键）
  assert.ok(!('vector' in metadata));
  assert.ok(!('chunk_id' in metadata));
});
