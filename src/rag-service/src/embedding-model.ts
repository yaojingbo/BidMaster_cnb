import type { MastraEmbeddingModel } from '@mastra/core/vector';
import type { RagConfig } from './config.js';
import { embedTexts } from './embedding.js';

/**
 * 产出 MastraEmbeddingModel（spec §7 方案 B）。
 *
 * 方案 A（@ai-sdk/openai 直指 DashScope）不可用：@ai-sdk/openai@4.0.43 产出
 * spec v4（specificationVersion:'v4'），而 @mastra/core@1.59.0 的 MastraEmbeddingModel
 * 只支持 spec v1/v2/v3。故实现自定义 v1 模型，内部复用 embedTexts（已实测连通 DashScope）。
 */
export function createEmbeddingModel(config: RagConfig): MastraEmbeddingModel<string> {
  return {
    specificationVersion: 'v1',
    provider: 'dashscope',
    modelId: config.RAG_EMBEDDING_MODEL,
    maxEmbeddingsPerCall: 10,
    supportsParallelCalls: true,
    doEmbed: async ({ values }) => ({
      embeddings: await embedTexts(values, config),
      usage: { tokens: 0 },
    }),
  };
}
