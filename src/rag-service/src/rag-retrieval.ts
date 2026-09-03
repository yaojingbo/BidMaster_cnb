import { createVectorQueryTool } from '@mastra/rag';
import type { RagConfig } from './config.js';
import { createEmbeddingModel } from './embedding-model.js';
import { collectionName } from './index-pipeline.js';
import { ZillizVectorStore } from './vector/zilliz-vector-store.js';

/**
 * 创建语义召回工具：注入自定义 ZillizVectorStore（MastraVector 实例）+ DashScope 嵌入模型。
 * 对应 spec §8.2「将实例直接传入 createVectorQueryTool」。
 */
export function createSemanticRecallTool(config: RagConfig, vectorStore: ZillizVectorStore) {
  return createVectorQueryTool({
    vectorStore,
    indexName: collectionName(config),
    model: createEmbeddingModel(config),
    description: '在招投标文档知识库中检索与问题语义相近的片段，返回候选上下文与来源。',
  });
}
