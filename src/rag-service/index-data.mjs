import { readFileSync } from 'node:fs';
import { loadConfig } from './dist/src/config.js';
import { indexDataDirectory } from './dist/src/index-docs.js';
import { ZillizVectorStore } from './dist/src/vector/zilliz-vector-store.js';

const env = {};
for (const line of readFileSync('/Users/yaojingboV2/1.Mynote/MyCreate/DevProject/bid-master-web/.env.local', 'utf8').split('\n')) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '').trim();
}

const config = loadConfig({
  ...env,
  RAG_INTERNAL_TOKEN: '12345678901234567890123456789012',
  RAG_EMBEDDING_DIMENSION: '1024',
  RAG_DATA_DIR: '/Users/yaojingboV2/1.Mynote/MyCreate/DevProject/bid-master-web/data',
});

const store = new ZillizVectorStore({
  uri: config.ZILLIZ_URI,
  token: config.ZILLIZ_TOKEN,
  database: config.ZILLIZ_DB_NAME,
});

const result = await indexDataDirectory(config.RAG_DATA_DIR, config, store, 'demo');
console.log('索引完成 =>', JSON.stringify(result));
