import { describe, it, expect } from 'vitest';
import { cn } from '../../lib/utils';

describe('Utils', () => {
  describe('cn (className merge)', () => {
    it('should merge two class names', () => {
      const result = cn('foo', 'bar');
      expect(result).toBe('foo bar');
    });

    it('should handle undefined values', () => {
      const result = cn('foo', undefined, 'bar');
      expect(result).toBe('foo bar');
    });

    it('should handle null values', () => {
      const result = cn('foo', null, 'bar');
      expect(result).toBe('foo bar');
    });

    it('should handle empty string', () => {
      const result = cn('foo', '', 'bar');
      expect(result).toBe('foo bar');
    });

    it('should handle conditional classes', () => {
      const isActive = true;
      const result = cn('base', isActive && 'active');
      expect(result).toBe('base active');
    });

    it('should handle false conditional', () => {
      const isActive = false;
      const result = cn('base', isActive && 'active');
      expect(result).toBe('base');
    });
  });
});
