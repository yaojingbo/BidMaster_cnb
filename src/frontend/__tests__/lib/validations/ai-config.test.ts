import { describe, it, expect } from 'vitest';
import { aiConfigSchema, providerTestRequestSchema } from '@/lib/validations/ai-config';

describe('AI Config Validation', () => {
  describe('aiConfigSchema', () => {
    it('should accept valid config', () => {
      const validData = {
        provider: 'openai',
        model: 'gpt-4o',
        apiKey: 'sk-test-key',
        isActive: true,
      };
      const result = aiConfigSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should accept config without apiKey for predefined providers', () => {
      const validData = {
        provider: 'openai',
        model: 'gpt-4o',
        isActive: true,
      };
      const result = aiConfigSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should reject unknown provider', () => {
      const invalidData = {
        provider: 'unknown_provider',
        model: 'gpt-4o',
      };
      const result = aiConfigSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should reject empty provider', () => {
      const invalidData = {
        provider: '',
        model: 'gpt-4o',
      };
      const result = aiConfigSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should accept valid providers', () => {
      const providers = ['openai', 'anthropic', 'azure', 'gemini', 'ollama', 'deepseek'];
      for (const provider of providers) {
        const validData = {
          provider,
          model: 'test-model',
        };
        const result = aiConfigSchema.safeParse(validData);
        expect(result.success).toBe(true);
      }
    });
  });

  describe('providerTestRequestSchema', () => {
    it('should accept valid test request', () => {
      const validData = {
        provider: 'openai',
        apiKey: 'sk-test-key',
      };
      const result = providerTestRequestSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should accept request without apiKey', () => {
      const validData = {
        provider: 'openai',
      };
      const result = providerTestRequestSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should reject empty provider', () => {
      const invalidData = {
        provider: '',
      };
      const result = providerTestRequestSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });
  });
});
