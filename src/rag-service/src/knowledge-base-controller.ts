import { z } from 'zod';
import type { KnowledgeBaseRepository } from './db/knowledge-base-repository.js';
import {
  knowledgeBaseCreateSchema,
  knowledgeBaseUpdateSchema,
} from './knowledge-base-contracts.js';

export class KnowledgeBaseHttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly retryable = false,
  ) {
    super(message);
  }
}

export class KnowledgeBaseHttpController {
  constructor(private readonly repository: KnowledgeBaseRepository) {}

  async list(userId: string, search: string): Promise<Record<string, unknown>> {
    const items = await this.repository.list(userId, search.trim().slice(0, 200));
    return { items };
  }

  async create(userId: string, payload: unknown): Promise<Record<string, unknown>> {
    const input = parsePayload(knowledgeBaseCreateSchema, payload);
    try {
      return await this.repository.create(userId, input.name, input.description);
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new KnowledgeBaseHttpError(409, 'KNOWLEDGE_BASE_NAME_EXISTS', '同名知识库已存在');
      }
      throw error;
    }
  }

  async detail(knowledgeBaseId: string, userId: string): Promise<Record<string, unknown>> {
    const item = await this.repository.get(knowledgeBaseId, userId);
    if (!item) throw notFound();
    return { ...item, files: [] };
  }

  async update(
    knowledgeBaseId: string,
    userId: string,
    payload: unknown,
  ): Promise<Record<string, unknown>> {
    const input = parsePayload(knowledgeBaseUpdateSchema, payload);
    try {
      const item = await this.repository.update(knowledgeBaseId, userId, input);
      if (!item) throw notFound();
      return item;
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new KnowledgeBaseHttpError(409, 'KNOWLEDGE_BASE_NAME_EXISTS', '同名知识库已存在');
      }
      throw error;
    }
  }

  async delete(knowledgeBaseId: string, userId: string): Promise<void> {
    if (!await this.repository.delete(knowledgeBaseId, userId)) throw notFound();
  }
}

function parsePayload<T>(schema: z.ZodType<T>, payload: unknown): T {
  const result = schema.safeParse(payload);
  if (!result.success) {
    throw new KnowledgeBaseHttpError(422, 'VALIDATION_ERROR', '请求参数无效');
  }
  return result.data;
}

function isUniqueViolation(error: unknown): boolean {
  return error instanceof Error && (
    (error as Error & { code?: string }).code === '23505'
    || error.message.includes('rag_kb_owner_name_uq')
  );
}

function notFound(): KnowledgeBaseHttpError {
  return new KnowledgeBaseHttpError(404, 'KNOWLEDGE_BASE_NOT_FOUND', '知识库不存在');
}
