import { describe, it, expect } from 'vitest';
import { analysisRequestSchema, analysisResponseSchema } from '@/lib/validations/analysis';

describe('Analysis Validation', () => {
  describe('analysisRequestSchema', () => {
    it('should accept valid request with prices', () => {
      const validData = {
        prices: [100, 200, 300, 400, 500],
      };
      const result = analysisRequestSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should accept valid request with fileId', () => {
      const validData = {
        fileId: '550e8400-e29b-41d4-a716-446655440000',
      };
      const result = analysisRequestSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should reject empty request', () => {
      const invalidData = {};
      const result = analysisRequestSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should reject both prices and fileId empty', () => {
      const invalidData = {
        prices: [],
        fileId: undefined,
      };
      const result = analysisRequestSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should reject negative prices', () => {
      const invalidData = {
        prices: [100, -200, 300],
      };
      const result = analysisRequestSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should accept decimal prices', () => {
      const validData = {
        prices: [100.5, 200.75, 300.25],
      };
      const result = analysisRequestSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should reject invalid uuid format for fileId', () => {
      const invalidData = {
        fileId: 'not-a-uuid',
      };
      const result = analysisRequestSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });
  });

  describe('analysisResponseSchema', () => {
    it('should accept valid response', () => {
      const validData = {
        success: true,
        data: {
          count: 5,
          averagePrice: 300,
          lowestPrice: 100,
          highestPrice: 500,
          medianPrice: 300,
          dispersionCoefficient: 0.5,
          priceRankings: [
            { rank: 1, bidderId: 'A', price: 100 },
            { rank: 2, bidderId: 'B', price: 200 },
          ],
          priceChanges: [10, 5, -3],
        },
      };
      const result = analysisResponseSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should reject response without success field', () => {
      const invalidData = {
        data: {
          count: 5,
        },
      };
      const result = analysisResponseSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should accept response with error detail', () => {
      const validData = {
        success: false,
        detail: 'Analysis failed',
      };
      const result = analysisResponseSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });
  });
});
