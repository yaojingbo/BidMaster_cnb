import { readFileSync } from 'node:fs';
import { loadConfig } from './dist/src/config.js';
import { answerQuery } from './dist/src/query-pipeline.js';
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
});

const store = new ZillizVectorStore({
  uri: config.ZILLIZ_URI,
  token: config.ZILLIZ_TOKEN,
  database: config.ZILLIZ_DB_NAME,
});

const question = process.argv[2] || '台州市招标文件规律';
const result = await answerQuery(question, config, store, 8);
console.log('问题:', question);
console.log('=== 回答 ===');
console.log(result.answer);
console.log('=== 来源片段（前3条）===');
for (const s of result.sources.slice(0, 3)) {
  console.log(`- [${s.id}] score=${s.score.toFixed(4)}: ${s.text.slice(0, 120)}`);
}
