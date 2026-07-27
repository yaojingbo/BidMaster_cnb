// src/lib/validations/document.ts
import { z } from 'zod';

// ============================================
// Document Validations
// ============================================
export const createDocumentSchema = z.object({
  name: z.string().min(1).max(500),
  originalName: z.string().min(1).max(500).optional(),
  size: z.number().positive().max(50 * 1024 * 1024), // 50MB max
  mimeType: z.enum([
    'application/pdf',
    'text/markdown',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/csv',
  ]),
  category: z.enum(['tender', 'bid']).default('tender'),
  encryptedPath: z.string().min(1),
  metadata: z.object({
    uploaderIp: z.string().optional(),
    extractionStatus: z.enum(['pending', 'processing', 'done', 'failed']).optional(),
    elementCount: z.number().optional(),
  }).optional(),
});

export const updateDocumentSchema = createDocumentSchema.partial();

export type CreateDocumentInput = z.infer<typeof createDocumentSchema>;
export type UpdateDocumentInput = z.infer<typeof updateDocumentSchema>;

// ============================================
// File Upload Response
// ============================================
export const fileUploadResponseSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  size: z.number(),
  type: z.string(),
  status: z.enum(['uploading', 'processing', 'ready', 'error']),
  createdAt: z.string().datetime(),
});

export type FileUploadResponse = z.infer<typeof fileUploadResponseSchema>;