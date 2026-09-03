import assert from 'node:assert/strict';
import test from 'node:test';
import { loadConfig } from '../src/config.js';
import { createEmbeddingModel } from '../src/embedding-model.js';

const token = '12345678901234567890123456789012';

test('createEmbeddingModel 产出 spec v1 MastraEmbeddingModel', () => {
  const config = loadConfig({
    RAG_INTERNAL_TOKEN: token,
    DASHSCOPE_API_KEY: 'key',
    DASHSCOPE_EMBEDDING_BASE_URL: 'https://example.invalid',
    RAG_EMBEDDING_MODEL: 'text-embedding-v4',
  });
  const model = createEmbeddingModel(config);
  assert.equal(model.specificationVersion, 'v1');
  assert.equal(model.provider, 'dashscope');
  assert.equal(model.modelId, 'text-embedding-v4');
  assert.equal(typeof model.doEmbed, 'function');
  assert.equal(model.maxEmbeddingsPerCall, 10);
});
