import { readFileSync } from 'node:fs';
import { spawn } from 'node:child_process';

const env = {};
for (const line of readFileSync('/Users/yaojingboV2/1.Mynote/MyCreate/DevProject/bid-master-web/.env.local', 'utf8').split('\n')) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '').trim();
}

const TOKEN = '0123456789abcdef0123456789abcdef';
const server = spawn('node', ['dist/src/server.js'], {
  env: {
    ...process.env,
    RAG_INTERNAL_TOKEN: TOKEN,
    ZILLIZ_URI: env.ZILLIZ_URI,
    ZILLIZ_TOKEN: env.ZILLIZ_TOKEN,
    ZILLIZ_DB_NAME: env.ZILLIZ_DB_NAME,
    DASHSCOPE_API_KEY: env.DASHSCOPE_API_KEY,
    DASHSCOPE_EMBEDDING_BASE_URL: env.DASHSCOPE_EMBEDDING_BASE_URL,
    RAG_EMBEDDING_DIMENSION: '1024',
  },
  stdio: 'ignore',
});

await new Promise((r) => setTimeout(r, 3000));
try {
  const res = await fetch('http://127.0.0.1:8100/internal/v1/rag/query', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      'X-Authenticated-User-Id': 'demo',
      'X-Request-Id': 'test-request-1',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ question: '台州市招标文件规律' }),
  });
  const data = await res.json();
  console.log('HTTP status:', res.status);
  console.log('success:', data.success);
  console.log('answer 前 200 字:', data.data?.answer?.slice(0, 200));
  console.log('sources 数:', data.data?.sources?.length);
} catch (e) {
  console.error('请求失败:', e.message);
} finally {
  server.kill();
}
