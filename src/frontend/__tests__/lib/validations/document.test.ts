import { describe, it, expect } from 'vitest';
import { createDocumentSchema } from '@/lib/validations/document';

describe('Document Validation', () => {
  describe('createDocumentSchema', () => {
    it('should accept valid PDF file', () => {
      const validData = {
        name: 'tender.pdf',
        size: 1024 * 1024, // 1MB
        mimeType: 'application/pdf',
        category: 'tender',
        encryptedPath: '/storage/abc123.enc',
      };
      const result = createDocumentSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should accept valid Markdown file', () => {
      const validData = {
        name: 'doc.md',
        size: 1024,
        mimeType: 'text/markdown',
        category: 'bid',
        encryptedPath: '/storage/def456.enc',
      };
      const result = createDocumentSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should accept valid Excel file', () => {
      const validData = {
        name: 'prices.xlsx',
        size: 2048,
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        category: 'tender',
        encryptedPath: '/storage/ghi789.enc',
      };
      const result = createDocumentSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should reject file larger than 50MB', () => {
      const invalidData = {
        name: 'huge.pdf',
        size: 51 * 1024 * 1024, // 51MB
        mimeType: 'application/pdf',
        category: 'tender',
        encryptedPath: '/storage/abc123.enc',
      };
      const result = createDocumentSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should reject file with size exactly 50MB', () => {
      const maxSizeData = {
        name: 'max.pdf',
        size: 50 * 1024 * 1024, // 50MB
        mimeType: 'application/pdf',
        category: 'tender',
        encryptedPath: '/storage/abc123.enc',
      };
      const result = createDocumentSchema.safeParse(maxSizeData);
      expect(result.success).toBe(true);
    });

    it('should reject unsupported mime types', () => {
      const invalidData = {
        name: 'malware.exe',
        size: 1024,
        mimeType: 'application/x-executable',
        category: 'tender',
        encryptedPath: '/storage/abc123.enc',
      };
      const result = createDocumentSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should reject executable mime type', () => {
      const invalidData = {
        name: 'virus.bat',
        size: 512,
        mimeType: 'application/x-msdownload',
        category: 'tender',
        encryptedPath: '/storage/abc123.enc',
      };
      const result = createDocumentSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should only allow tender or bid category', () => {
      const validTender = {
        name: 'test.pdf',
        size: 1024,
        mimeType: 'application/pdf',
        category: 'tender',
        encryptedPath: '/storage/abc123.enc',
      };
      const validBid = {
        name: 'test.pdf',
        size: 1024,
        mimeType: 'application/pdf',
        category: 'bid',
        encryptedPath: '/storage/abc123.enc',
      };
      const invalidCategory = {
        name: 'test.pdf',
        size: 1024,
        mimeType: 'application/pdf',
        category: 'invalid',
        encryptedPath: '/storage/abc123.enc',
      };
      expect(createDocumentSchema.safeParse(validTender).success).toBe(true);
      expect(createDocumentSchema.safeParse(validBid).success).toBe(true);
      expect(createDocumentSchema.safeParse(invalidCategory).success).toBe(false);
    });

    it('should reject empty name', () => {
      const invalidData = {
        name: '',
        size: 1024,
        mimeType: 'application/pdf',
        category: 'tender',
        encryptedPath: '/storage/abc123.enc',
      };
      const result = createDocumentSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should reject negative size', () => {
      const invalidData = {
        name: 'test.pdf',
        size: -100,
        mimeType: 'application/pdf',
        category: 'tender',
        encryptedPath: '/storage/abc123.enc',
      };
      const result = createDocumentSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should reject zero size', () => {
      const invalidData = {
        name: 'test.pdf',
        size: 0,
        mimeType: 'application/pdf',
        category: 'tender',
        encryptedPath: '/storage/abc123.enc',
      };
      const result = createDocumentSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should accept optional metadata', () => {
      const validData = {
        name: 'test.pdf',
        size: 1024,
        mimeType: 'application/pdf',
        category: 'tender',
        encryptedPath: '/storage/abc123.enc',
        metadata: {
          uploaderIp: '192.168.1.1',
          extractionStatus: 'pending',
          elementCount: 5,
        },
      };
      const result = createDocumentSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should reject invalid extraction status in metadata', () => {
      const invalidData = {
        name: 'test.pdf',
        size: 1024,
        mimeType: 'application/pdf',
        category: 'tender',
        encryptedPath: '/storage/abc123.enc',
        metadata: {
          extractionStatus: 'invalid_status',
        },
      };
      const result = createDocumentSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });
  });
});
