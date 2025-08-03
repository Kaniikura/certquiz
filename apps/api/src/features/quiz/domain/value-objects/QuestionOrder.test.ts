import { testIds } from '@api/test-support/utils/id-generators';
import { describe, expect, it } from 'vitest';
import type { QuestionId } from './Ids';
import { QuestionOrder } from './QuestionOrder';

describe('QuestionOrder', () => {
  const questionIds: QuestionId[] = [
    testIds.questionId('q1'),
    testIds.questionId('q2'),
    testIds.questionId('q3'),
  ];

  describe('create()', () => {
    it('should create order with given question IDs', () => {
      const order = QuestionOrder.create(questionIds);

      expect(order.size).toBe(3);
      expect(order.getAllIds()).toEqual(questionIds);
    });

    it('should maintain question order', () => {
      const ids = [
        testIds.questionId('first'),
        testIds.questionId('second'),
        testIds.questionId('third'),
      ];
      const order = QuestionOrder.create(ids);

      expect(order.getIndex(ids[0])).toBe(0);
      expect(order.getIndex(ids[1])).toBe(1);
      expect(order.getIndex(ids[2])).toBe(2);
    });

    it('should throw error for empty question list', () => {
      expect(() => QuestionOrder.create([])).toThrow('Question order cannot be empty');
    });

    it('should throw error for duplicate question IDs', () => {
      const duplicateIds = [
        testIds.questionId('q1'),
        testIds.questionId('q2'),
        testIds.questionId('q1'), // duplicate
      ];

      expect(() => QuestionOrder.create(duplicateIds)).toThrow(
        'Question order contains duplicate IDs'
      );
    });
  });

  describe('fromPersistence()', () => {
    it('should restore order from persistence', () => {
      const order = QuestionOrder.fromPersistence(questionIds);

      expect(order.size).toBe(3);
      expect(order.getAllIds()).toEqual(questionIds);
    });

    it('should handle single question', () => {
      const singleId = [testIds.questionId('single')];
      const order = QuestionOrder.fromPersistence(singleId);

      expect(order.size).toBe(1);
      expect(order.has(singleId[0])).toBe(true);
    });
  });

  describe('has()', () => {
    it('should return true for existing question ID', () => {
      const order = QuestionOrder.create(questionIds);

      expect(order.has(questionIds[0])).toBe(true);
      expect(order.has(questionIds[1])).toBe(true);
      expect(order.has(questionIds[2])).toBe(true);
    });

    it('should return false for non-existing question ID', () => {
      const order = QuestionOrder.create(questionIds);
      const nonExistentId = testIds.questionId('non-existent');

      expect(order.has(nonExistentId)).toBe(false);
    });
  });

  describe('getIndex()', () => {
    it('should return correct index for existing question', () => {
      const order = QuestionOrder.create(questionIds);

      expect(order.getIndex(questionIds[0])).toBe(0);
      expect(order.getIndex(questionIds[1])).toBe(1);
      expect(order.getIndex(questionIds[2])).toBe(2);
    });

    it('should return -1 for non-existing question', () => {
      const order = QuestionOrder.create(questionIds);
      const nonExistentId = testIds.questionId('non-existent');

      expect(order.getIndex(nonExistentId)).toBe(-1);
    });

    it('should perform O(1) lookup', () => {
      // Create large order to test performance
      const largeIds = Array.from({ length: 1000 }, (_, i) => testIds.questionId(`q${i}`));
      const order = QuestionOrder.create(largeIds);

      // Test multiple lookups - should be fast
      const startTime = performance.now();
      for (let i = 0; i < 100; i++) {
        const randomIndex = Math.floor(Math.random() * largeIds.length);
        order.getIndex(largeIds[randomIndex]);
      }
      const endTime = performance.now();

      // 100 lookups should complete in under 10ms (very generous for O(1))
      expect(endTime - startTime).toBeLessThan(10);
    });
  });

  describe('getAllIds()', () => {
    it('should return defensive copy of question IDs', () => {
      const order = QuestionOrder.create(questionIds);
      const retrievedIds = order.getAllIds();

      // Should be equal but not same reference
      expect(retrievedIds).toEqual(questionIds);
      expect(retrievedIds).not.toBe(questionIds);

      // Modifying returned array should not affect original
      retrievedIds.push(testIds.questionId('new'));
      expect(order.size).toBe(3); // Original unchanged
    });

    it('should maintain original order', () => {
      const shuffledIds = [...questionIds].reverse();
      const order = QuestionOrder.create(shuffledIds);

      expect(order.getAllIds()).toEqual(shuffledIds);
    });
  });

  describe('toPersistence()', () => {
    it('should return defensive copy for persistence', () => {
      const order = QuestionOrder.create(questionIds);
      const persistenceData = order.toPersistence();

      expect(persistenceData).toEqual(questionIds);
      expect(persistenceData).not.toBe(questionIds);
    });

    it('should roundtrip correctly', () => {
      const originalOrder = QuestionOrder.create(questionIds);
      const persistenceData = originalOrder.toPersistence();
      const restoredOrder = QuestionOrder.fromPersistence(persistenceData);

      expect(restoredOrder.getAllIds()).toEqual(originalOrder.getAllIds());
      expect(restoredOrder.size).toBe(originalOrder.size);

      // Test that indices are preserved
      for (const id of questionIds) {
        expect(restoredOrder.getIndex(id)).toBe(originalOrder.getIndex(id));
      }
    });
  });

  describe('size', () => {
    it('should return correct size', () => {
      expect(QuestionOrder.create([testIds.questionId('single')]).size).toBe(1);
      expect(QuestionOrder.create(questionIds).size).toBe(3);
    });
  });

  describe('edge cases', () => {
    it('should handle very long question IDs', () => {
      const longId = testIds.questionId('a'.repeat(1000));
      const order = QuestionOrder.create([longId]);

      expect(order.has(longId)).toBe(true);
      expect(order.getIndex(longId)).toBe(0);
    });

    it('should handle special characters in question IDs', () => {
      const specialIds = [
        testIds.questionId('q-with-dashes'),
        testIds.questionId('q_with_underscores'),
        testIds.questionId('q.with.dots'),
      ];
      const order = QuestionOrder.create(specialIds);

      specialIds.forEach((id, index) => {
        expect(order.has(id)).toBe(true);
        expect(order.getIndex(id)).toBe(index);
      });
    });

    it('should handle maximum realistic question count', () => {
      // Test with QuizConfig.MAX_QUESTION_COUNT (100)
      const maxIds = Array.from({ length: 100 }, (_, i) => testIds.questionId(`q${i}`));
      const order = QuestionOrder.create(maxIds);

      expect(order.size).toBe(100);
      expect(order.getIndex(maxIds[0])).toBe(0);
      expect(order.getIndex(maxIds[99])).toBe(99);
    });
  });

  describe('immutability', () => {
    it('should be immutable after creation', () => {
      const originalIds = [...questionIds];
      const order = QuestionOrder.create(questionIds);

      // Modify original array
      questionIds.push(testIds.questionId('new'));

      // Order should be unchanged
      expect(order.getAllIds()).toEqual(originalIds);
      expect(order.size).toBe(3);
    });
  });
});
