import assert from 'node:assert/strict';
import test from 'node:test';
import { MastraVector } from '@mastra/core/vector';
import {
  ZillizVectorStore,
  mapSearchResults,
  readDimension,
  readMetric,
} from '../src/vector/zilliz-vector-store.js';

const ABSTRACT_METHODS = [
  'query', 'upsert', 'createIndex', 'listIndexes', 'describeIndex',
  'deleteIndex', 'updateVector', 'deleteVector', 'deleteVectors',
];

test('ZillizVectorStore 是 MastraVector 子类', () => {
  const store = new ZillizVectorStore({ uri: 'https://example.invalid' });
  assert.ok(store instanceof MastraVector);
});

test('实现全部 9 个抽象方法', () => {
  const store = new ZillizVectorStore({ uri: 'https://example.invalid' }) as unknown as Record<string, unknown>;
  for (const method of ABSTRACT_METHODS) {
    assert.equal(typeof store[method], 'function', `缺少方法 ${method}`);
  }
});

test('id 默认 zilliz，可自定义', () => {
  assert.equal(new ZillizVectorStore({ uri: 'https://example.invalid' }).id, 'zilliz');
  assert.equal(new ZillizVectorStore({ uri: 'https://example.invalid', id: 'milvus' }).id, 'milvus');
});

test('空 id 抛错（基类契约）', () => {
  assert.throws(() => new ZillizVectorStore({ uri: 'https://example.invalid', id: '' }));
});

test('indexSeparator 保持默认 _', () => {
  assert.equal(new ZillizVectorStore({ uri: 'https://example.invalid' }).indexSeparator, '_');
});

test('mapSearchResults 映射 REST 搜索响应', () => {
  const res = {
    data: [
      { id: 'c1', chunk_id: 'c1', distance: 0.92, user_id: 'u1', file_id: 'f1', index_version: 'v3' },
      { chunk_id: 'c2', distance: '0.5', user_id: 'u1' },
    ],
  };
  const results = mapSearchResults(res, false);
  assert.equal(results.length, 2);
  assert.equal(results[0].id, 'c1');
  assert.equal(results[0].score, 0.92);
  assert.equal(results[0].metadata?.user_id, 'u1');
  assert.equal(results[0].vector, undefined);
  assert.equal(results[1].id, 'c2');
  assert.equal(results[1].score, 0.5);
});

test('mapSearchResults 空数据返回空数组', () => {
  assert.deepEqual(mapSearchResults({ data: [] }, false), []);
  assert.deepEqual(mapSearchResults({}, false), []);
});

test('readDimension 提取向量维度（params 数组格式）', () => {
  assert.equal(readDimension({ fields: [{ type: 'FloatVector', params: [{ key: 'dim', value: '1024' }] }] }), 1024);
  assert.equal(readDimension({ fields: [{ dataType: 'FloatVector', elementTypeParams: { dim: 512 } }] }), 512);
  assert.equal(readDimension({ fields: [{ type: 'VarChar', params: [{ key: 'max_length', value: '64' }] }] }), undefined);
  assert.equal(readDimension(null), undefined);
});

test('readMetric 提取 metric 并映射回 Mastra', () => {
  assert.equal(readMetric({ indexes: [{ fieldName: 'vector', metricType: 'COSINE' }] }), 'cosine');
  assert.equal(readMetric({ indexes: [{ fieldName: 'vector', metricType: 'L2' }] }), 'euclidean');
  assert.equal(readMetric({ indexes: [{ fieldName: 'vector', metricType: 'IP' }] }), 'dotproduct');
  assert.equal(readMetric({ indexes: [{ fieldName: 'other', metricType: 'COSINE' }] }), undefined);
});
