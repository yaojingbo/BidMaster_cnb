import { z } from 'zod';

const environmentSchema = z.object({
  HOST: z.string().default('127.0.0.1'),
  PORT: z.coerce.number().int().min(1).max(65535).default(8100),
  RAG_INTERNAL_TOKEN: z.string().min(32),
  RAG_DATABASE_URL: z.string().min(1).optional(),
  DASHSCOPE_API_KEY: z.string().min(1).optional(),
  DASHSCOPE_EMBEDDING_BASE_URL: z.string().url().optional(),
  RAG_EMBEDDING_MODEL: z.string().default('qwen3-vl-embedding'),
  RAG_EMBEDDING_DIMENSION: z.coerce.number().int().positive().optional(),
  RAG_INDEX_VERSION: z.string().default('v3-qwen3-vl-embedding'),
  RAG_VECTOR_COLLECTION: z.string().default('bidmaster_rag_chunks'),
  ZILLIZ_ADDRESS: z.string().min(1).optional(),
  ZILLIZ_TOKEN: z.string().min(1).optional(),
});

export type RagConfig = z.infer<typeof environmentSchema>;

export function loadConfig(environment: Record<string, string | undefined> = process.env): RagConfig {
  return environmentSchema.parse(environment);
}

export function readinessFromConfig(config: RagConfig): Record<string, boolean> {
  return {
    neon: Boolean(config.RAG_DATABASE_URL),
    embedding: Boolean(
      config.DASHSCOPE_API_KEY
      && config.DASHSCOPE_EMBEDDING_BASE_URL
      && config.RAG_EMBEDDING_MODEL === 'qwen3-vl-embedding'
      && config.RAG_EMBEDDING_DIMENSION,
    ),
    zilliz: Boolean(config.ZILLIZ_ADDRESS && config.ZILLIZ_TOKEN && config.RAG_VECTOR_COLLECTION),
  };
}
