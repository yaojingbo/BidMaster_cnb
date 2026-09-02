import { z } from 'zod';

export const knowledgeBaseCreateSchema = z.object({
  name: z.string().trim().min(1).max(200),
  description: z.string().max(2000).default(''),
}).strict();

export const knowledgeBaseUpdateSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  description: z.string().max(2000).optional(),
}).strict().refine((value) => value.name !== undefined || value.description !== undefined, {
  message: '至少需要提供一个可更新字段',
});

export type KnowledgeBaseCreateInput = z.infer<typeof knowledgeBaseCreateSchema>;
export type KnowledgeBaseUpdateInput = z.infer<typeof knowledgeBaseUpdateSchema>;
