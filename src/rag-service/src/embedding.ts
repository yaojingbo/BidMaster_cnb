import type { RagConfig } from './config.js';

/** 单批嵌入条数（避免单次请求过大） */
const EMBED_BATCH_SIZE = 10;

/**
 * 用 DashScope 的 OpenAI 兼容 /embeddings 接口批量生成向量。
 * 返回的向量顺序与 texts 输入顺序一致。
 */
export async function embedTexts(texts: string[], config: RagConfig): Promise<number[][]> {
  const results: number[][] = [];
  for (let i = 0; i < texts.length; i += EMBED_BATCH_SIZE) {
    const batch = texts.slice(i, i + EMBED_BATCH_SIZE);
    results.push(...(await embedBatch(batch, config)));
  }
  return results;
}

async function embedBatch(texts: string[], config: RagConfig): Promise<number[][]> {
  const url = `${config.DASHSCOPE_EMBEDDING_BASE_URL}/embeddings`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.DASHSCOPE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ model: config.RAG_EMBEDDING_MODEL, input: texts }),
  });
  if (!response.ok) {
    throw new Error(`DashScope embedding 失败: HTTP ${response.status}`);
  }
  const json = (await response.json()) as { data?: Array<{ embedding: number[] }> };
  if (!json.data || json.data.length !== texts.length) {
    throw new Error('DashScope embedding 响应条数与输入不一致');
  }
  return json.data.map((item) => item.embedding);
}
