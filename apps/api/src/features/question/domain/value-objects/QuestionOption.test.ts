/**
 * QuestionOption value object tests
 * @fileoverview Tests for individual question option validation and behavior
 */

import { describe, expect, it } from 'vitest';
import { QuestionOption } from './QuestionOption';

describe('QuestionOption', () => {
  describe('create', () => {
    it('should create a valid option', () => {
      const result = QuestionOption.create({
        id: '123e4567-e89b-12d3-a456-426614174000',
        text: 'This is a valid option',
        isCorrect: false,
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.id).toBe('123e4567-e89b-12d3-a456-426614174000');
        expect(result.data.text).toBe('This is a valid option');
        expect(result.data.isCorrect).toBe(false);
      }
    });

    it('should fail with empty text', () => {
      const result = QuestionOption.create({
        id: '123e4567-e89b-12d3-a456-426614174000',
        text: '',
        isCorrect: false,
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toContain('Option text cannot be empty');
      }
    });

    it('should fail with whitespace-only text', () => {
      const result = QuestionOption.create({
        id: '123e4567-e89b-12d3-a456-426614174000',
        text: '   ',
        isCorrect: false,
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toContain('Option text cannot be empty');
      }
    });

    it('should fail with invalid UUID', () => {
      const result = QuestionOption.create({
        id: 'not-a-uuid',
        text: 'Valid text',
        isCorrect: false,
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toContain('Invalid option ID format');
      }
    });

    it('should trim text whitespace', () => {
      const result = QuestionOption.create({
        id: '123e4567-e89b-12d3-a456-426614174000',
        text: '  Option with spaces  ',
        isCorrect: true,
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.text).toBe('Option with spaces');
      }
    });

    it('should handle very long text', () => {
      const longText = 'a'.repeat(1001); // Over 1000 chars
      const result = QuestionOption.create({
        id: '123e4567-e89b-12d3-a456-426614174000',
        text: longText,
        isCorrect: false,
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toContain('Option text too long');
      }
    });
  });

  describe('equals', () => {
    it('should return true for identical options', () => {
      const option1 = QuestionOption.create({
        id: '123e4567-e89b-12d3-a456-426614174000',
        text: 'Same text',
        isCorrect: true,
      });

      const option2 = QuestionOption.create({
        id: '123e4567-e89b-12d3-a456-426614174000',
        text: 'Same text',
        isCorrect: true,
      });

      expect(option1.success && option2.success).toBe(true);
      if (option1.success && option2.success) {
        expect(option1.data.equals(option2.data)).toBe(true);
      }
    });

    it('should return false for different IDs', () => {
      const option1 = QuestionOption.create({
        id: '123e4567-e89b-12d3-a456-426614174000',
        text: 'Same text',
        isCorrect: true,
      });

      const option2 = QuestionOption.create({
        id: '987e4567-e89b-12d3-a456-426614174000',
        text: 'Same text',
        isCorrect: true,
      });

      expect(option1.success && option2.success).toBe(true);
      if (option1.success && option2.success) {
        expect(option1.data.equals(option2.data)).toBe(false);
      }
    });

    it('should return false for different text', () => {
      const option1 = QuestionOption.create({
        id: '123e4567-e89b-12d3-a456-426614174000',
        text: 'Text 1',
        isCorrect: true,
      });

      const option2 = QuestionOption.create({
        id: '123e4567-e89b-12d3-a456-426614174000',
        text: 'Text 2',
        isCorrect: true,
      });

      expect(option1.success && option2.success).toBe(true);
      if (option1.success && option2.success) {
        expect(option1.data.equals(option2.data)).toBe(false);
      }
    });

    it('should return false for different isCorrect', () => {
      const option1 = QuestionOption.create({
        id: '123e4567-e89b-12d3-a456-426614174000',
        text: 'Same text',
        isCorrect: true,
      });

      const option2 = QuestionOption.create({
        id: '123e4567-e89b-12d3-a456-426614174000',
        text: 'Same text',
        isCorrect: false,
      });

      expect(option1.success && option2.success).toBe(true);
      if (option1.success && option2.success) {
        expect(option1.data.equals(option2.data)).toBe(false);
      }
    });
  });

  describe('toJSON', () => {
    it('should serialize to JSON format', () => {
      const option = QuestionOption.create({
        id: '123e4567-e89b-12d3-a456-426614174000',
        text: 'Option text',
        isCorrect: true,
      });

      expect(option.success).toBe(true);
      if (option.success) {
        const json = option.data.toJSON();
        expect(json).toEqual({
          id: '123e4567-e89b-12d3-a456-426614174000',
          text: 'Option text',
          isCorrect: true,
        });
      }
    });
  });

  describe('fromJSON', () => {
    it('should deserialize from valid JSON', () => {
      const json = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        text: 'Option text',
        isCorrect: true,
      };

      const result = QuestionOption.fromJSON(json);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.id).toBe(json.id);
        expect(result.data.text).toBe(json.text);
        expect(result.data.isCorrect).toBe(json.isCorrect);
      }
    });

    it('should fail with invalid JSON structure', () => {
      const invalidJson = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        // missing text and isCorrect
      };

      const result = QuestionOption.fromJSON(invalidJson);

      expect(result.success).toBe(false);
    });
  });
});
