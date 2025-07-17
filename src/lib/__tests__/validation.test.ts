import { describe, it, expect } from 'vitest';
import {
  validateToolSubmission,
  validateUrl,
  validateTags,
  parseTagsFromString,
  toolSubmissionSchema,
  tagSchema
} from '../validation';

describe('Validation Schemas', () => {
  describe('validateToolSubmission', () => {
    it('should validate a valid tool submission', () => {
      const validSubmission = {
        url: 'https://example.com',
        tags: ['development', 'tools'],
        submitterName: 'John Doe',
        submitterGithubUrl: 'https://github.com/johndoe'
      };

      const result = validateToolSubmission(validSubmission);
      expect(result.success).toBe(true);
    });

    it('should reject invalid URL', () => {
      const invalidSubmission = {
        url: 'not-a-url',
        tags: ['development']
      };

      const result = validateToolSubmission(invalidSubmission);
      expect(result.success).toBe(false);
    });

    it('should reject empty tags array', () => {
      const invalidSubmission = {
        url: 'https://example.com',
        tags: []
      };

      const result = validateToolSubmission(invalidSubmission);
      expect(result.success).toBe(false);
    });
  });

  describe('validateUrl', () => {
    it('should validate correct URLs', () => {
      expect(validateUrl('https://example.com').success).toBe(true);
      expect(validateUrl('http://localhost:3000').success).toBe(true);
    });

    it('should reject invalid URLs', () => {
      expect(validateUrl('not-a-url').success).toBe(false);
      expect(validateUrl('').success).toBe(false);
    });
  });

  describe('validateTags', () => {
    it('should validate non-empty tag arrays', () => {
      expect(validateTags(['react', 'javascript']).success).toBe(true);
    });

    it('should reject empty arrays', () => {
      expect(validateTags([]).success).toBe(false);
    });

    it('should reject arrays with empty strings', () => {
      expect(validateTags(['react', '']).success).toBe(false);
    });
  });

  describe('parseTagsFromString', () => {
    it('should parse comma-separated tags', () => {
      const result = parseTagsFromString('react, javascript, web development');
      expect(result).toEqual(['react', 'javascript', 'web development']);
    });

    it('should handle extra whitespace', () => {
      const result = parseTagsFromString('  react  ,  javascript  ,  ');
      expect(result).toEqual(['react', 'javascript']);
    });

    it('should handle empty string', () => {
      const result = parseTagsFromString('');
      expect(result).toEqual([]);
    });
  });
});
