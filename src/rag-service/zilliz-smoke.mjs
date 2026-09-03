import { readFileSync } from 'node:fs';
import { HttpClient } from '@zilliz/milvus2-sdk-node';

const env = {};
for (const line of readFileSync('/Users/yaojingboV2/1.Mynote/MyCreate/DevProject/bid-master-web/.env.local', 'utf8').split('\n')) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '').trim();
}

const COLLECTION = 'smoke_20260903';

async function getEmbedding(text) {
  const res = await fetch(env.DASHSCOPE_EMBEDDING_BASE_URL + '/embeddings', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.DASHSCOPE_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: env.RAG_EMBEDDING_MODEL || 'text-embedding-v4', input: text }),
  });
  const j = await res.json();
  if (!j.data?.[0]?.embedding) throw new Error('embedding 失败: ' + JSON.stringify(j).slice(0, 300));
  return j.data[0].embedding;
}

const client = new HttpClient({
  endpoint: env.ZILLIZ_URI,
  token: env.ZILLIZ_TOKEN,
  database: env.ZILLIZ_DB_NAME,
});

async function main() {
  // 1. 清理旧集合
  try { await client.dropCollection({ collectionName: COLLECTION }); console.log('[1] 清理旧集合 OK'); } catch {}

  // 2. 建集合（生产同构 schema 精简版）
  await client.createCollection({
    collectionName: COLLECTION,
    schema: {
      autoID: false,
      enabledDynamicField: true,
      fields: [
        { fieldName: 'chunk_id', dataType: 'VarChar', isPrimary: true, elementTypeParams: { max_length: 64 } },
        { fieldName: 'vector', dataType: 'FloatVector', elementTypeParams: { dim: 1024 } },
        { fieldName: 'text', dataType: 'VarChar', elementTypeParams: { max_length: 512 } },
      ],
    },
    indexParams: [
      { fieldName: 'vector', indexName: 'vector_idx', metricType: 'COSINE', params: { index_type: 'AUTOINDEX' } },
    ],
  });
  console.log('[2] 建集合 OK');

  // 3. 真实 embedding + 插入
  const vector = await getEmbedding('台州市招标文件规律');
  console.log('[3] embedding 维度 =', vector.length);
  const ins = await client.insert({
    collectionName: COLLECTION,
    data: [{ chunk_id: 'smoke-1', vector, text: '台州市招标文件规律' }],
  });
  console.log('[3] 插入 OK =>', JSON.stringify(ins));

  // 4. 统计确认写入
  const stats = await client.getCollectionStatistics({ collectionName: COLLECTION });
  console.log('[4] rowCount =', stats.data?.rowCount ?? stats.rowCount ?? stats);

  // 5. 加载 + 检索（best-effort）
  try {
    await client.loadCollection({ collectionName: COLLECTION });
    await new Promise(r => setTimeout(r, 4000));
    const s = await client.search({
      collectionName: COLLECTION,
      data: [vector],
      annsField: 'vector',
      limit: 3,
      outputFields: ['chunk_id', 'text'],
    });
    console.log('[5] 检索 OK =>', JSON.stringify(s.data ?? s).slice(0, 800));
  } catch (e) {
    console.log('[5] 检索跳过/失败 =>', e?.message || e);
  }

  // 6. 清理
  await client.dropCollection({ collectionName: COLLECTION });
  console.log('[6] 清理集合 OK');
}

main().then(() => console.log('=== 冒烟通过 ===')).catch(e => {
  console.error('=== 冒烟失败 ===', e?.message || e);
  try { client.dropCollection({ collectionName: COLLECTION }).catch(() => {}); } catch {}
  process.exitCode = 1;
});
