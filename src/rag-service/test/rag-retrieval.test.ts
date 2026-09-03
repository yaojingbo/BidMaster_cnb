import assert from 'node:assert/strict';
import test from 'node:test';
import { loadConfig } from '../src/config.js';
import { createSemanticRecallTool } from '../src/rag-retrieval.js';
import { ZillizVectorStore } from '../src/vector/zilliz-vector-store.js';

const token = '12345678901234567890123456789012';

test('createSemanticRecallTool 返回带 execute 的 RagTool（构造不触发网络）', () => {
  const config = loadConfig({ RAG_INTERNAL_TOKEN: token });
  const store = new ZillizVectorStore({ uri: 'https://example.invalid' });
  const tool = createSemanticRecallTool(config, store);
  assert.equal(typeof tool.execute, 'function');
  assert.ok(tool.id, '工具 id 非空');
});
