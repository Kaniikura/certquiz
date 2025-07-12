/**
 * Tests for branded ID types and factory functions
 * @fileoverview Comprehensive tests for type-safe ID generation and usage
 */

import { describe, expect, it } from 'vitest';
import { AnswerId, OptionId, QuestionId, QuizSessionId, UserId } from './Ids';

describe('Branded ID Types', () => {
  describe('QuizSessionId', () => {
    it('should generate unique IDs', () => {
      const id1 = QuizSessionId.generate();
      const id2 = QuizSessionId.generate();

      expect(id1).not.toBe(id2);
      expect(typeof id1).toBe('string');
      expect(typeof id2).toBe('string');
    });

    it('should create ID from string value', () => {
      const value = 'test-quiz-session-id';
      const id = QuizSessionId.of(value);

      expect(QuizSessionId.toString(id)).toBe(value);
    });

    it('should compare IDs correctly', () => {
      const value = 'same-id';
      const id1 = QuizSessionId.of(value);
      const id2 = QuizSessionId.of(value);
      const id3 = QuizSessionId.of('different-id');

      expect(QuizSessionId.equals(id1, id2)).toBe(true);
      expect(QuizSessionId.equals(id1, id3)).toBe(false);
    });

    it('should convert to string', () => {
      const value = 'quiz-session-123';
      const id = QuizSessionId.of(value);

      expect(QuizSessionId.toString(id)).toBe(value);
    });

    it('should generate UUID format by default', () => {
      const id = QuizSessionId.generate();
      const uuidRegex =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

      expect(uuidRegex.test(QuizSessionId.toString(id))).toBe(true);
    });
  });

  describe('UserId', () => {
    it('should generate unique IDs', () => {
      const id1 = UserId.generate();
      const id2 = UserId.generate();

      expect(id1).not.toBe(id2);
      expect(typeof id1).toBe('string');
      expect(typeof id2).toBe('string');
    });

    it('should create ID from string value', () => {
      const value = 'user-12345';
      const id = UserId.of(value);

      expect(UserId.toString(id)).toBe(value);
    });

    it('should compare IDs correctly', () => {
      const value = 'user-abc';
      const id1 = UserId.of(value);
      const id2 = UserId.of(value);
      const id3 = UserId.of('user-def');

      expect(UserId.equals(id1, id2)).toBe(true);
      expect(UserId.equals(id1, id3)).toBe(false);
    });

    it('should generate UUID format', () => {
      const id = UserId.generate();
      const uuidRegex =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

      expect(uuidRegex.test(UserId.toString(id))).toBe(true);
    });
  });

  describe('QuestionId', () => {
    it('should generate unique IDs', () => {
      const id1 = QuestionId.generate();
      const id2 = QuestionId.generate();

      expect(id1).not.toBe(id2);
    });

    it('should create ID from string value', () => {
      const value = 'question-ccna-001';
      const id = QuestionId.of(value);

      expect(QuestionId.toString(id)).toBe(value);
    });

    it('should compare IDs correctly', () => {
      const value = 'question-test';
      const id1 = QuestionId.of(value);
      const id2 = QuestionId.of(value);
      const id3 = QuestionId.of('question-other');

      expect(QuestionId.equals(id1, id2)).toBe(true);
      expect(QuestionId.equals(id1, id3)).toBe(false);
    });
  });

  describe('OptionId', () => {
    it('should generate unique IDs', () => {
      const id1 = OptionId.generate();
      const id2 = OptionId.generate();

      expect(id1).not.toBe(id2);
    });

    it('should create ID from string value', () => {
      const value = 'option-A';
      const id = OptionId.of(value);

      expect(OptionId.toString(id)).toBe(value);
    });

    it('should compare IDs correctly', () => {
      const value = 'option-B';
      const id1 = OptionId.of(value);
      const id2 = OptionId.of(value);
      const id3 = OptionId.of('option-C');

      expect(OptionId.equals(id1, id2)).toBe(true);
      expect(OptionId.equals(id1, id3)).toBe(false);
    });
  });

  describe('AnswerId', () => {
    it('should generate unique IDs', () => {
      const id1 = AnswerId.generate();
      const id2 = AnswerId.generate();

      expect(id1).not.toBe(id2);
    });

    it('should create ID from string value', () => {
      const value = 'answer-submission-123';
      const id = AnswerId.of(value);

      expect(AnswerId.toString(id)).toBe(value);
    });

    it('should compare IDs correctly', () => {
      const value = 'answer-test';
      const id1 = AnswerId.of(value);
      const id2 = AnswerId.of(value);
      const id3 = AnswerId.of('answer-other');

      expect(AnswerId.equals(id1, id2)).toBe(true);
      expect(AnswerId.equals(id1, id3)).toBe(false);
    });
  });

  describe('Type Safety', () => {
    it('should prevent mixing different ID types', () => {
      const quizId = QuizSessionId.generate();
      const userId = UserId.generate();
      const questionId = QuestionId.generate();

      // These should be compile-time errors but we can test runtime behavior
      // @ts-expect-error - should not accept different ID type
      expect(QuizSessionId.equals(quizId, userId)).toBe(false);
      // @ts-expect-error - should not accept different ID type
      expect(UserId.equals(userId, questionId)).toBe(false);
    });

    it('should maintain brand type information', () => {
      const quizId = QuizSessionId.generate();
      const userId = UserId.generate();

      // These should have different branded types
      expect(typeof quizId).toBe('string');
      expect(typeof userId).toBe('string');

      // But TypeScript should treat them as different types
      // This is enforced at compile time, not runtime
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty string IDs', () => {
      const emptyQuizId = QuizSessionId.of('');
      const emptyUserId = UserId.of('');

      expect(QuizSessionId.toString(emptyQuizId)).toBe('');
      expect(UserId.toString(emptyUserId)).toBe('');
    });

    it('should handle very long IDs', () => {
      const longId = 'a'.repeat(1000);
      const quizId = QuizSessionId.of(longId);

      expect(QuizSessionId.toString(quizId)).toBe(longId);
    });

    it('should handle special characters in IDs', () => {
      const specialId = 'id-with_special.chars@domain.com';
      const questionId = QuestionId.of(specialId);

      expect(QuestionId.toString(questionId)).toBe(specialId);
    });

    it('should handle Unicode characters', () => {
      const unicodeId = 'id-with-émojis-🎯-and-中文';
      const optionId = OptionId.of(unicodeId);

      expect(OptionId.toString(optionId)).toBe(unicodeId);
    });
  });

  describe('Performance', () => {
    it('should generate IDs efficiently', () => {
      const startTime = performance.now();

      // Generate many IDs
      for (let i = 0; i < 1000; i++) {
        QuizSessionId.generate();
        UserId.generate();
        QuestionId.generate();
        OptionId.generate();
        AnswerId.generate();
      }

      const endTime = performance.now();

      // 5000 ID generations should complete quickly
      expect(endTime - startTime).toBeLessThan(100); // 100ms is generous
    });

    it('should perform comparisons efficiently', () => {
      // Pre-generate IDs
      const ids = Array.from({ length: 1000 }, () => QuizSessionId.generate());

      const startTime = performance.now();

      // Perform many comparisons
      for (let i = 0; i < 1000; i++) {
        QuizSessionId.equals(ids[i % ids.length], ids[(i + 1) % ids.length]);
      }

      const endTime = performance.now();

      // 1000 comparisons should be very fast
      expect(endTime - startTime).toBeLessThan(10);
    });
  });

  describe('Factory Function Consistency', () => {
    it('should have consistent API across all ID types', () => {
      const testValue = 'test-id-123';

      // All ID types should support these operations
      const quizId = QuizSessionId.of(testValue);
      const userId = UserId.of(testValue);
      const questionId = QuestionId.of(testValue);
      const optionId = OptionId.of(testValue);
      const answerId = AnswerId.of(testValue);

      expect(QuizSessionId.toString(quizId)).toBe(testValue);
      expect(UserId.toString(userId)).toBe(testValue);
      expect(QuestionId.toString(questionId)).toBe(testValue);
      expect(OptionId.toString(optionId)).toBe(testValue);
      expect(AnswerId.toString(answerId)).toBe(testValue);
    });

    it('should generate different values for each type', () => {
      // Even though they use the same underlying generation logic,
      // each call should produce a different value
      const id1 = QuizSessionId.generate();
      const id2 = QuizSessionId.generate();
      const id3 = UserId.generate();
      const id4 = QuestionId.generate();

      const ids = [
        QuizSessionId.toString(id1),
        QuizSessionId.toString(id2),
        UserId.toString(id3),
        QuestionId.toString(id4),
      ];

      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(4); // All should be unique
    });
  });

  describe('Branded Type Validation', () => {
    it('should maintain type brands at runtime', () => {
      const quizId = QuizSessionId.generate();
      const userId = UserId.generate();

      // At runtime, they're just strings
      expect(typeof quizId).toBe('string');
      expect(typeof userId).toBe('string');

      // But they should not be equal even with same string value
      const sameValue = 'same-string-value';
      const quizIdFromValue = QuizSessionId.of(sameValue);
      const userIdFromValue = UserId.of(sameValue);

      // At runtime these are the same string, but TypeScript treats them differently
      expect(QuizSessionId.toString(quizIdFromValue)).toBe(UserId.toString(userIdFromValue));
    });

    it('should work with Set and Map collections', () => {
      const quizIds = [
        QuizSessionId.generate(),
        QuizSessionId.generate(),
        QuizSessionId.generate(),
      ];

      // Should work in Set
      const idSet = new Set(quizIds);
      expect(idSet.size).toBe(3);

      // Should work as Map keys
      const idMap = new Map<QuizSessionId, string>();
      quizIds.forEach((id, index) => {
        idMap.set(id, `value-${index}`);
      });
      expect(idMap.size).toBe(3);
    });
  });
});
