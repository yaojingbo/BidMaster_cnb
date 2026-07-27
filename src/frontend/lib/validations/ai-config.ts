// src/lib/validations/ai-config.ts
import { z } from 'zod';

// ============================================
// Provider Schema
// ============================================
export const providerSchema = z.object({
  id: z.string(),
  name: z.string(),
  models: z.array(z.string()),
});

export const providersResponseSchema = z.object({
  providers: z.array(providerSchema),
  active: z.string(),
});

export type ProvidersResponse = z.infer<typeof providersResponseSchema>;

// ============================================
// AI Config Schema (for test compatibility)
// ============================================
const validProviders = ['openai', 'anthropic', 'azure', 'gemini', 'ollama', 'deepseek'] as const;

export const aiConfigSchema = z.object({
  provider: z.enum(validProviders),
  model: z.string(),
  apiKey: z.string().optional(),
  isActive: z.boolean().default(true),
});

export type AIConfigInput = z.infer<typeof aiConfigSchema>;

// ============================================
// Test Connection Request
// ============================================
export const testConnectionSchema = z.object({
  provider: z.string(),
  apiKey: z.string().optional(),
});

export const testConnectionResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  latencyMs: z.number().optional(),
  error: z.string().optional(),
});

export type TestConnectionInput = z.infer<typeof testConnectionSchema>;
export type TestConnectionResponse = z.infer<typeof testConnectionResponseSchema>;

// ============================================
// Provider Test Request (for test compatibility)
// ============================================
export const providerTestRequestSchema = z.object({
  provider: z.string().min(1),
  apiKey: z.string().optional(),
});

// ============================================
// Provider Configuration
// ============================================
export const providerConfigSchema = z.object({
  provider: z.string(),
  model: z.string(),
  apiKeyRef: z.string().optional(),
  apiEndpoint: z.string().url().optional(),
});

export type ProviderConfigInput = z.infer<typeof providerConfigSchema>;