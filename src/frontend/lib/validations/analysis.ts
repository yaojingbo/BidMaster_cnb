// src/lib/validations/analysis.ts
import { z } from 'zod';

// ============================================
// Element Schema
// ============================================
export const elementSchema = z.object({
  name: z.enum(['资质要求', '评标办法', '业绩门槛', '定标方法', '合同条款']),
  content: z.string().min(1),
  confidence: z.number().min(0).max(100).optional(),
  position: z.object({
    page: z.number().optional(),
    startLine: z.number().optional(),
    endLine: z.number().optional(),
  }).optional(),
});

// ============================================
// Statistics Schema
// ============================================
export const statisticsDataSchema = z.object({
  prices: z.array(z.number()).optional(),
  priceRankings: z.array(z.object({
    bidderId: z.string(),
    price: z.number(),
    rank: z.number(),
  })).optional(),
  averagePrice: z.number().optional(),
  lowestPrice: z.number().optional(),
  highestPrice: z.number().optional(),
  dispersionCoefficient: z.number().optional(),
  priceChanges: z.array(z.number()).optional(),
});

// ============================================
// Analysis Request/Response Schemas
// ============================================
export const analysisRequestSchema = z.object({
  prices: z.array(z.number().nonnegative()).optional(),
  fileId: z.string().uuid().optional(),
}).refine(data => data.prices?.length || data.fileId, {
  message: 'Either prices array or fileId must be provided',
});

export const analysisResponseSchema = z.object({
  success: z.boolean(),
  data: z.object({
    count: z.number().optional(),
    averagePrice: z.number().optional(),
    lowestPrice: z.number().optional(),
    highestPrice: z.number().optional(),
    medianPrice: z.number().optional(),
    dispersionCoefficient: z.number().optional(),
    priceRankings: z.array(z.object({
      rank: z.number(),
      bidderId: z.string(),
      price: z.number(),
    })).optional(),
    priceChanges: z.array(z.number()).optional(),
  }).optional(),
  detail: z.string().optional(),
});

// ============================================
// Analysis Result Schema
// ============================================
export const createAnalysisSchema = z.object({
  documentId: z.string().uuid(),
  type: z.enum(['element_extract', 'opening_analysis', 'simulated_doc']),
  model: z.string().optional(),
  provider: z.string().optional(),
});

export const analysisResultSchema = z.object({
  id: z.string().uuid(),
  documentId: z.string().uuid(),
  type: z.string(),
  status: z.enum(['pending', 'processing', 'done', 'failed']),
  result: z.object({
    elements: z.array(elementSchema).optional(),
    statistics: statisticsDataSchema.optional(),
    summary: z.string().optional(),
  }).nullable(),
  model: z.string().nullable(),
  provider: z.string().nullable(),
  error: z.string().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type CreateAnalysisInput = z.infer<typeof createAnalysisSchema>;
export type AnalysisResultData = z.infer<typeof analysisResultSchema>;

// ============================================
// SSE Stream Event Schema
// ============================================
export const streamEventSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('progress'),
    message: z.string(),
  }),
  z.object({
    type: z.literal('element'),
    data: elementSchema,
  }),
  z.object({
    type: z.literal('statistics'),
    data: statisticsDataSchema,
  }),
  z.object({
    type: z.literal('done'),
    data: z.object({
      summary: z.string(),
      elementCount: z.number().optional(),
    }),
  }),
  z.object({
    type: z.literal('error'),
    data: z.object({
      message: z.string(),
    }),
  }),
]);

export type StreamEvent = z.infer<typeof streamEventSchema>;