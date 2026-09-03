import { z } from 'zod';
import type { RagConfig } from './config.js';
import { indexDataDirectory } from './index-docs.js';
import { KnowledgeBaseHttpError } from './knowledge-base-controller.js';
import { answerQuery } from './query-pipeline.js';
import { ZillizVectorStore } from './vector/zilliz-vector-store.js';

const querySchema = z.object({
  question: z.string().min(1).max(2000),
  topK: z.coerce.number().int().min(1).max(50).optional(),
});

/** RAG 查询/索引 HTTP 控制器：把 answerQuery / indexDataDirectory 暴露给内部协议。 */
export class RagHttpController {
  constructor(
    private readonly config: RagConfig,
    private readonly vectorStore: ZillizVectorStore,
  ) {}

  async query(payload: unknown): Promise<Record<string, unknown>> {
    const input = parsePayload(querySchema, payload);
    const { answer, sources } = await answerQuery(input.question, this.config, this.vectorStore, input.topK ?? 8);
    return { answer, sources };
  }

  async index(userId: string, _payload: unknown): Promise<Record<string, unknown>> {
    // 索引目录来自服务端配置 RAG_DATA_DIR，不接受请求体传入，避免任意路径读取（SSRF/路径穿越）
    const dataDir = this.config.RAG_DATA_DIR;
    if (!dataDir) {
      throw new KnowledgeBaseHttpError(503, 'RAG_DATA_DIR_NOT_CONFIGURED', '未配置索引数据目录');
    }
    const summary = await indexDataDirectory(dataDir, this.config, this.vectorStore, userId);
    return { files: summary.files, chunkCount: summary.chunkCount };
  }
}

function parsePayload<T>(schema: z.ZodType<T>, payload: unknown): T {
  const result = schema.safeParse(payload);
  if (!result.success) {
    throw new KnowledgeBaseHttpError(422, 'VALIDATION_ERROR', '请求参数无效');
  }
  return result.data;
}
