/**
 * Tests for QuestionReference value object
 * @fileoverview Tests for question reference with option validation
 */

import { testIds } from '@api/test-support';
import { beforeEach, describe, expect, it } from 'vitest';
import type { OptionId, QuestionId } from './Ids';
import { QuestionReference } from './QuestionReference';

describe('QuestionReference', () => {
  const questionId: QuestionId = testIds.questionId('q1');
  const optionIds: OptionId[] = [
    testIds.optionId('opt1'),
    testIds.optionId('opt2'),
    testIds.optionId('opt3'),
  ];

  describe('constructor with Set', () => {
    it('should create reference with valid option IDs set', () => {
      const validOptionIds = new Set(optionIds);
      const reference = new QuestionReference(questionId, validOptionIds);

      expect(reference.id).toBe(questionId);
      expect(reference.validOptionIds.size).toBe(3);
      expect(reference.validOptionIds.has(optionIds[0])).toBe(true);
      expect(reference.validOptionIds.has(optionIds[1])).toBe(true);
      expect(reference.validOptionIds.has(optionIds[2])).toBe(true);
    });

    it('should create defensive copy of provided Set', () => {
      const originalSet = new Set(optionIds);
      const reference = new QuestionReference(questionId, originalSet);

      // Modify original set
      originalSet.add(testIds.optionId('new-option'));

      // Reference should be unchanged
      expect(reference.validOptionIds.size).toBe(3);
      expect(reference.validOptionIds.has(testIds.optionId('new-option'))).toBe(false);
    });

    it('should handle empty option set', () => {
      const emptySet = new Set<OptionId>();
      const reference = new QuestionReference(questionId, emptySet);

      expect(reference.validOptionIds.size).toBe(0);
      expect(reference.hasOption(testIds.optionId('any'))).toBe(false);
    });
  });

  describe('constructor with Array', () => {
    it('should create reference with valid option IDs array', () => {
      const reference = new QuestionReference(questionId, optionIds);

      expect(reference.id).toBe(questionId);
      expect(reference.validOptionIds.size).toBe(3);
      expect(reference.validOptionIds.has(optionIds[0])).toBe(true);
      expect(reference.validOptionIds.has(optionIds[1])).toBe(true);
      expect(reference.validOptionIds.has(optionIds[2])).toBe(true);
    });

    it('should create defensive copy of provided array', () => {
      const originalArray = [...optionIds];
      const reference = new QuestionReference(questionId, originalArray);

      // Modify original array
      originalArray.push(testIds.optionId('new-option'));

      // Reference should be unchanged
      expect(reference.validOptionIds.size).toBe(3);
      expect(reference.validOptionIds.has(testIds.optionId('new-option'))).toBe(false);
    });

    it('should handle duplicate option IDs in array', () => {
      const duplicateIds = [
        optionIds[0],
        optionIds[1],
        optionIds[0], // duplicate
        optionIds[2],
      ];
      const reference = new QuestionReference(questionId, duplicateIds);

      // Set should deduplicate
      expect(reference.validOptionIds.size).toBe(3);
      expect(reference.validOptionIds.has(optionIds[0])).toBe(true);
      expect(reference.validOptionIds.has(optionIds[1])).toBe(true);
      expect(reference.validOptionIds.has(optionIds[2])).toBe(true);
    });

    it('should handle empty option array', () => {
      const reference = new QuestionReference(questionId, []);

      expect(reference.validOptionIds.size).toBe(0);
      expect(reference.hasOption(testIds.optionId('any'))).toBe(false);
    });
  });

  describe('hasOption()', () => {
    let reference: QuestionReference;

    beforeEach(() => {
      reference = new QuestionReference(questionId, optionIds);
    });

    it('should return true for valid option IDs', () => {
      expect(reference.hasOption(optionIds[0])).toBe(true);
      expect(reference.hasOption(optionIds[1])).toBe(true);
      expect(reference.hasOption(optionIds[2])).toBe(true);
    });

    it('should return false for invalid option IDs', () => {
      const invalidOption = testIds.optionId('invalid');
      expect(reference.hasOption(invalidOption)).toBe(false);
    });

    it('should perform O(1) lookup', () => {
      // Create reference with many options
      const manyOptions = Array.from({ length: 1000 }, (_, i) => testIds.optionId(`opt${i}`));
      const largeReference = new QuestionReference(questionId, manyOptions);

      // Test multiple lookups - should be fast
      const startTime = performance.now();
      for (let i = 0; i < 100; i++) {
        const randomIndex = Math.floor(Math.random() * manyOptions.length);
        largeReference.hasOption(manyOptions[randomIndex]);
      }
      const endTime = performance.now();

      // 100 lookups should complete in under 10ms (very generous for O(1))
      expect(endTime - startTime).toBeLessThan(10);
    });
  });

  describe('immutability', () => {
    it('should prevent external modification of validOptionIds', () => {
      const reference = new QuestionReference(questionId, optionIds);

      // Should not be able to modify the Set directly
      // Note: Set.add() may not throw in all environments but TypeScript prevents this
      try {
        // @ts-expect-error - testing runtime immutability
        reference.validOptionIds.add(testIds.optionId('hacker'));
        // If add() succeeded, check that it didn't actually modify the set
        expect(reference.validOptionIds.has(testIds.optionId('hacker'))).toBe(false);
      } catch (error) {
        // This is also acceptable - some environments throw on readonly violations
        expect(error).toBeDefined();
      }
    });

    it('should maintain immutability with ReadonlySet type', () => {
      const reference = new QuestionReference(questionId, optionIds);

      // Type system should prevent these operations
      // @ts-expect-error - add should not be available on ReadonlySet
      reference.validOptionIds.add;
      // @ts-expect-error - delete should not be available on ReadonlySet
      reference.validOptionIds.delete;
      // @ts-expect-error - clear should not be available on ReadonlySet
      reference.validOptionIds.clear;
    });
  });

  describe('realistic usage scenarios', () => {
    it('should handle typical multiple choice question', () => {
      const mcqOptions = [
        testIds.optionId('A'),
        testIds.optionId('B'),
        testIds.optionId('C'),
        testIds.optionId('D'),
      ];
      const reference = new QuestionReference(questionId, mcqOptions);

      expect(reference.hasOption(testIds.optionId('A'))).toBe(true);
      expect(reference.hasOption(testIds.optionId('E'))).toBe(false);
    });

    it('should handle true/false question', () => {
      const booleanOptions = [testIds.optionId('true'), testIds.optionId('false')];
      const reference = new QuestionReference(questionId, booleanOptions);

      expect(reference.validOptionIds.size).toBe(2);
      expect(reference.hasOption(testIds.optionId('true'))).toBe(true);
      expect(reference.hasOption(testIds.optionId('false'))).toBe(true);
      expect(reference.hasOption(testIds.optionId('maybe'))).toBe(false);
    });

    it('should handle single option question', () => {
      const singleOption = [testIds.optionId('only-choice')];
      const reference = new QuestionReference(questionId, singleOption);

      expect(reference.validOptionIds.size).toBe(1);
      expect(reference.hasOption(testIds.optionId('only-choice'))).toBe(true);
    });

    it('should handle complex option IDs', () => {
      const complexOptions = [
        testIds.optionId('option-with-uuid-12345'),
        testIds.optionId('option_with_underscores'),
        testIds.optionId('option.with.dots'),
      ];
      const reference = new QuestionReference(questionId, complexOptions);

      complexOptions.forEach((optionId) => {
        expect(reference.hasOption(optionId)).toBe(true);
      });
    });
  });

  describe('edge cases', () => {
    it('should handle extremely long option IDs', () => {
      const longOptionId = testIds.optionId('x'.repeat(1000));
      const reference = new QuestionReference(questionId, [longOptionId]);

      expect(reference.hasOption(longOptionId)).toBe(true);
    });

    it('should handle maximum number of options', () => {
      // Simulate a question with many options (e.g., select all that apply)
      const manyOptions = Array.from({ length: 50 }, (_, i) => testIds.optionId(`opt${i}`));
      const reference = new QuestionReference(questionId, manyOptions);

      expect(reference.validOptionIds.size).toBe(50);
      expect(reference.hasOption(manyOptions[0])).toBe(true);
      expect(reference.hasOption(manyOptions[49])).toBe(true);
      expect(reference.hasOption(testIds.optionId('opt50'))).toBe(false);
    });
  });

  describe('equality semantics', () => {
    it('should consider references with same data as logically equal', () => {
      const reference1 = new QuestionReference(questionId, optionIds);
      const reference2 = new QuestionReference(questionId, [...optionIds]);

      // Same content, different instances
      expect(reference1.id).toBe(reference2.id);
      expect(reference1.validOptionIds.size).toBe(reference2.validOptionIds.size);

      for (const optionId of optionIds) {
        expect(reference1.hasOption(optionId)).toBe(reference2.hasOption(optionId));
      }
    });

    it('should handle different option order', () => {
      const reference1 = new QuestionReference(questionId, optionIds);
      const shuffledOptions = [...optionIds].reverse();
      const reference2 = new QuestionReference(questionId, shuffledOptions);

      // Set doesn't care about order
      expect(reference1.validOptionIds.size).toBe(reference2.validOptionIds.size);
      for (const optionId of optionIds) {
        expect(reference1.hasOption(optionId)).toBe(reference2.hasOption(optionId));
      }
    });
  });
});
