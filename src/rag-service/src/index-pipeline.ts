import type { RagConfig } from './config.js';
import { embedTexts } from './embedding.js';
import { RagChunker, type ChunkDraft } from './rag-chunker.js';
import { ZillizVectorStore } from './vector/zilliz-vector-store.js';

/** 派生版本化 collection 名（spec §4.2）；Milvus collection 名只允许数字、字母、下划线 */
export function collectionName(config: Pick<RagConfig, 'RAG_VECTOR_COLLECTION' | 'RAG_INDEX_VERSION'>): string {
  const raw = `${config.RAG_VECTOR_COLLECTION}_${config.RAG_INDEX_VERSION}`;
  return raw.replace(/[^a-zA-Z0-9_]/g, '_');
}

/** 生成幂等 chunk_id（MVP 无 Neon，用 fileId + 序号，重跑可覆盖） */
export function buildChunkId(fileId: string, chunkIndex: number): string {
  return `${fileId}-${chunkIndex}`;
}

export interface IndexDocumentParams {
  fileId: string;
  fileName: string;
  content: string;
  userId: string;
}

export interface ChunkMetadataContext {
  fileId: string;
  userId: string;
  indexVersion: string;
}

/** 由 chunk 构建 upsert metadata（导出供单测） */
export function buildChunkMetadata(chunk: ChunkDraft, ctx: ChunkMetadataContext): Record<string, unknown> {
  return {
    text: chunk.content,
    user_id: ctx.userId,
    file_id: ctx.fileId,
    index_id: ctx.fileId,
    index_version: ctx.indexVersion,
    chunk_type: chunk.chunk_type,
  };
}

/** 索引单篇文档：分块 → 嵌入 → 建集合（幂等）→ upsert。返回 chunk 数。 */
export async function indexDocument(
  params: IndexDocumentParams,
  config: RagConfig,
  vectorStore: ZillizVectorStore,
): Promise<number> {
  const chunks = new RagChunker().chunk(params.content);
  if (chunks.length === 0) return 0;

  const dimension = config.RAG_EMBEDDING_DIMENSION;
  if (!dimension) throw new Error('RAG_EMBEDDING_DIMENSION 未配置');

  const indexName = collectionName(config);
  await vectorStore.createIndex({ indexName, dimension, metric: 'cosine' });

  const embeddings = await embedTexts(chunks.map((chunk) => chunk.content), config);
  if (embeddings.length !== chunks.length) throw new Error('嵌入条数与 chunk 数不一致');

  await vectorStore.upsert({
    indexName,
    vectors: embeddings,
    ids: chunks.map((_, index) => buildChunkId(params.fileId, index)),
    metadata: chunks.map((chunk) => buildChunkMetadata(chunk, {
      fileId: params.fileId,
      userId: params.userId,
      indexVersion: config.RAG_INDEX_VERSION,
    })),
  });
  return chunks.length;
}
