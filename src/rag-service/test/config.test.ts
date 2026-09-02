import assert from 'node:assert/strict';
import test from 'node:test';
import { loadConfig, readinessFromConfig } from '../src/config.js';

const token = '12345678901234567890123456789012';

test('配置统一读取 RAG_DATABASE_URL', () => {
  const config = loadConfig({
    RAG_INTERNAL_TOKEN: token,
    RAG_DATABASE_URL: 'postgresql://example.invalid/bidmaster',
  });

  assert.equal(config.RAG_DATABASE_URL, 'postgresql://example.invalid/bidmaster');
  assert.equal(readinessFromConfig(config).neon, true);
});

test('通用 DATABASE_URL 不会误判 RAG 数据库已就绪', () => {
  const config = loadConfig({
    RAG_INTERNAL_TOKEN: token,
    DATABASE_URL: 'postgresql://example.invalid/core',
  });

  assert.equal(config.RAG_DATABASE_URL, undefined);
  assert.equal(readinessFromConfig(config).neon, false);
});
