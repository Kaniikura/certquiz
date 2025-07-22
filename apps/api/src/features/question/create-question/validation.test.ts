/**
 * Create question validation tests
 * @fileoverview Tests for the createQuestionSchema including business rule validation
 */

import { describe, expect, it } from 'vitest';
import { createQuestionSchema } from './validation';

describe('createQuestionSchema - Option Business Rules', () => {
  const baseValidRequest = {
    questionText: 'What is the capital of France?',
    questionType: 'multiple_choice' as const,
    explanation: 'This is about geography',
    options: [
      { text: 'Paris', isCorrect: true },
      { text: 'London', isCorrect: false },
    ],
    examTypes: ['Geography'],
    categories: ['World Capitals'],
    difficulty: 'Beginner' as const,
  };

  describe('New Options (isNew: true)', () => {
    it('should accept new options without id', () => {
      const request = {
        ...baseValidRequest,
        options: [
          { text: 'Paris', isCorrect: true, isNew: true },
          { text: 'London', isCorrect: false, isNew: true },
        ],
      };

      const result = createQuestionSchema.safeParse(request);
      expect(result.success).toBe(true);
    });

    it('should reject new options with id', () => {
      const request = {
        ...baseValidRequest,
        options: [
          {
            text: 'Paris',
            isCorrect: true,
            isNew: true,
            id: '123e4567-e89b-12d3-a456-426614174001',
          },
          { text: 'London', isCorrect: false, isNew: true },
        ],
      };

      const result = createQuestionSchema.safeParse(request);
      expect(result.success).toBe(false);
      if (!result.success) {
        const idError = result.error.errors.find(
          (e) => e.path.includes('options') && e.path.includes('id')
        );
        expect(idError?.message).toBe('New options (isNew: true) should not include an id field');
      }
    });
  });

  describe('Existing Options (isNew: false)', () => {
    it('should accept existing options with valid UUID id', () => {
      const request = {
        ...baseValidRequest,
        options: [
          {
            text: 'Paris',
            isCorrect: true,
            isNew: false,
            id: '123e4567-e89b-12d3-a456-426614174001',
          },
          {
            text: 'London',
            isCorrect: false,
            isNew: false,
            id: '123e4567-e89b-12d3-a456-426614174002',
          },
        ],
      };

      const result = createQuestionSchema.safeParse(request);
      expect(result.success).toBe(true);
    });

    it('should reject existing options without id', () => {
      const request = {
        ...baseValidRequest,
        options: [
          { text: 'Paris', isCorrect: true, isNew: false },
          { text: 'London', isCorrect: false, isNew: false },
        ],
      };

      const result = createQuestionSchema.safeParse(request);
      expect(result.success).toBe(false);
      if (!result.success) {
        const idError = result.error.errors.find(
          (e) => e.path.includes('options') && e.path.includes('id')
        );
        expect(idError?.message).toBe(
          'Existing options (isNew: false) must include a valid UUID id'
        );
      }
    });
  });

  describe('Backward Compatibility (isNew not specified)', () => {
    it('should accept options without isNew field and no id (default behavior)', () => {
      const request = {
        ...baseValidRequest,
        options: [
          { text: 'Paris', isCorrect: true },
          { text: 'London', isCorrect: false },
        ],
      };

      const result = createQuestionSchema.safeParse(request);
      expect(result.success).toBe(true);
    });

    it('should accept options without isNew field but with valid id', () => {
      const request = {
        ...baseValidRequest,
        options: [
          { text: 'Paris', isCorrect: true, id: '123e4567-e89b-12d3-a456-426614174001' },
          { text: 'London', isCorrect: false },
        ],
      };

      const result = createQuestionSchema.safeParse(request);
      expect(result.success).toBe(true);
    });
  });

  describe('Mixed Options', () => {
    it('should accept mix of new and existing options', () => {
      const request = {
        ...baseValidRequest,
        options: [
          { text: 'Paris', isCorrect: true, isNew: true }, // New option
          {
            text: 'London',
            isCorrect: false,
            isNew: false,
            id: '123e4567-e89b-12d3-a456-426614174002',
          }, // Existing option
          { text: 'Berlin', isCorrect: false }, // Legacy format (no isNew specified)
        ],
      };

      const result = createQuestionSchema.safeParse(request);
      expect(result.success).toBe(true);
    });
  });
});
