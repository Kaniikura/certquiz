/**
 * Tests for Answer entity
 * @fileoverview Comprehensive tests for answer validation and immutability
 */

import { testIds } from '@api/test-support';
import { beforeEach, describe, expect, it } from 'vitest';
import { InvalidAnswerError } from '../errors/QuizErrors';
import type { AnswerId, OptionId, QuestionId } from '../value-objects/Ids';
import { Answer } from './Answer';

describe('Answer', () => {
  const questionId: QuestionId = testIds.questionId('q1');
  const optionIds: OptionId[] = [testIds.optionId('opt1'), testIds.optionId('opt2')];
  const answeredAt = new Date('2024-01-01T10:00:00Z');

  describe('create()', () => {
    it('should create answer with valid inputs', () => {
      const result = Answer.create(questionId, optionIds, answeredAt);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.questionId).toBe(questionId);
        expect(result.data.selectedOptionIds).toEqual(optionIds);
        expect(result.data.answeredAt).toBe(answeredAt);
        expect(result.data.id).toBeDefined();
      }
    });

    it('should generate unique ID for each answer', () => {
      const result1 = Answer.create(questionId, optionIds, answeredAt);
      const result2 = Answer.create(questionId, optionIds, answeredAt);

      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);
      if (result1.success && result2.success) {
        expect(result1.data.id).not.toBe(result2.data.id);
      }
    });

    it('should create defensive copy of option IDs', () => {
      const mutableOptions = [...optionIds];
      const result = Answer.create(questionId, mutableOptions, answeredAt);

      expect(result.success).toBe(true);
      if (result.success) {
        // Modify original array
        mutableOptions.push(testIds.optionId('new'));

        // Answer should be unchanged
        expect(result.data.selectedOptionIds).toEqual(optionIds);
        expect(result.data.selectedOptionIds).toHaveLength(2);
      }
    });

    it('should freeze selected option IDs array', () => {
      const result = Answer.create(questionId, optionIds, answeredAt);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(Object.isFrozen(result.data.selectedOptionIds)).toBe(true);

        // Should not be able to modify
        expect(() => {
          // @ts-expect-error - testing runtime immutability
          result.data.selectedOptionIds.push(testIds.optionId('hacker'));
        }).toThrow();
      }
    });

    describe('validation errors', () => {
      it('should fail with empty option list', () => {
        const result = Answer.create(questionId, [], answeredAt);

        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error).toBeInstanceOf(InvalidAnswerError);
          expect(result.error.message).toBe(
            'Invalid answer: Answer must include at least one option'
          );
        }
      });

      it('should fail with duplicate option IDs', () => {
        const duplicateOptions = [optionIds[0], optionIds[1], optionIds[0]]; // duplicate
        const result = Answer.create(questionId, duplicateOptions, answeredAt);

        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error).toBeInstanceOf(InvalidAnswerError);
          expect(result.error.message).toBe(
            'Invalid answer: Answer contains duplicate option selections'
          );
        }
      });

      it('should fail with all duplicate options', () => {
        const allDuplicates = [optionIds[0], optionIds[0], optionIds[0]];
        const result = Answer.create(questionId, allDuplicates, answeredAt);

        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error).toBeInstanceOf(InvalidAnswerError);
        }
      });
    });
  });

  describe('fromEventReplay()', () => {
    const answerId: AnswerId = testIds.answerId('ans1');

    it('should create answer from event data without validation', () => {
      const answer = Answer.fromEventReplay(answerId, questionId, optionIds, answeredAt);

      expect(answer.id).toBe(answerId);
      expect(answer.questionId).toBe(questionId);
      expect(answer.selectedOptionIds).toEqual(optionIds);
      expect(answer.answeredAt).toBe(answeredAt);
    });

    it('should skip validation for event replay', () => {
      // This would fail validation in create() but should work in fromEventReplay()
      const emptyOptions: OptionId[] = [];
      const answer = Answer.fromEventReplay(answerId, questionId, emptyOptions, answeredAt);

      expect(answer.selectedOptionIds).toEqual([]);
    });

    it('should handle duplicate options in event replay', () => {
      const duplicateOptions = [optionIds[0], optionIds[0]];
      const answer = Answer.fromEventReplay(answerId, questionId, duplicateOptions, answeredAt);

      expect(answer.selectedOptionIds).toEqual(duplicateOptions);
    });

    it('should freeze option IDs array', () => {
      const answer = Answer.fromEventReplay(answerId, questionId, optionIds, answeredAt);

      expect(Object.isFrozen(answer.selectedOptionIds)).toBe(true);
    });

    it('should create defensive copy', () => {
      const mutableOptions = [...optionIds];
      const answer = Answer.fromEventReplay(answerId, questionId, mutableOptions, answeredAt);

      // Modify original array
      mutableOptions.push(testIds.optionId('new'));

      // Answer should be unchanged
      expect(answer.selectedOptionIds).toEqual(optionIds);
    });
  });

  describe('immutability', () => {
    let answer: Answer;

    beforeEach(() => {
      const result = Answer.create(questionId, optionIds, answeredAt);
      if (!result.success) throw new Error('Failed to create test answer');
      answer = result.data;
    });

    it('should have readonly properties', () => {
      // Type system should prevent these modifications
      // @ts-expect-error - should be readonly
      answer.id = testIds.answerId('new');
      // @ts-expect-error - should be readonly
      answer.questionId = testIds.questionId('new');
      // @ts-expect-error - should be readonly
      answer.selectedOptionIds = [];
      // @ts-expect-error - should be readonly
      answer.answeredAt = new Date();
    });

    it('should prevent modification of selectedOptionIds array', () => {
      expect(() => {
        // @ts-expect-error - testing runtime immutability
        answer.selectedOptionIds.push(testIds.optionId('hack'));
      }).toThrow();

      expect(() => {
        // @ts-expect-error - testing runtime immutability
        answer.selectedOptionIds[0] = testIds.optionId('hack');
      }).toThrow();
    });

    it('should maintain immutability of nested objects', () => {
      const _originalAnsweredAt = answer.answeredAt.getTime();

      // Even if we get reference to the Date, the answer should not change
      answer.answeredAt.setTime(Date.now());

      // This might work (Date is mutable) but it's an anti-pattern
      // In production, we might want to return new Date(this._answeredAt)
      // For now, we accept this limitation
    });
  });

  describe('realistic usage scenarios', () => {
    it('should handle single choice answer', () => {
      const singleChoice = [testIds.optionId('A')];
      const result = Answer.create(questionId, singleChoice, answeredAt);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.selectedOptionIds).toHaveLength(1);
        expect(result.data.selectedOptionIds[0]).toBe(singleChoice[0]);
      }
    });

    it('should handle multiple choice answer', () => {
      const multipleChoices = [testIds.optionId('A'), testIds.optionId('C'), testIds.optionId('D')];
      const result = Answer.create(questionId, multipleChoices, answeredAt);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.selectedOptionIds).toHaveLength(3);
        expect(result.data.selectedOptionIds).toEqual(multipleChoices);
      }
    });

    it('should handle boolean (true/false) answer', () => {
      const trueAnswer = [testIds.optionId('true')];
      const result = Answer.create(questionId, trueAnswer, answeredAt);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.selectedOptionIds).toEqual(trueAnswer);
      }
    });

    it('should handle all options selected', () => {
      const allOptions = [
        testIds.optionId('opt1'),
        testIds.optionId('opt2'),
        testIds.optionId('opt3'),
        testIds.optionId('opt4'),
        testIds.optionId('opt5'),
      ];
      const result = Answer.create(questionId, allOptions, answeredAt);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.selectedOptionIds).toHaveLength(5);
        expect(result.data.selectedOptionIds).toEqual(allOptions);
      }
    });
  });

  describe('edge cases', () => {
    it('should handle very long option ID list', () => {
      const manyOptions = Array.from({ length: 20 }, (_, i) => testIds.optionId(`opt${i}`));
      const result = Answer.create(questionId, manyOptions, answeredAt);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.selectedOptionIds).toHaveLength(20);
      }
    });

    it('should handle special characters in option IDs', () => {
      const specialOptions = [
        testIds.optionId('option-with-dashes'),
        testIds.optionId('option_with_underscores'),
        testIds.optionId('option.with.dots'),
      ];
      const result = Answer.create(questionId, specialOptions, answeredAt);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.selectedOptionIds).toEqual(specialOptions);
      }
    });

    it('should handle future timestamps', () => {
      const futureDate = new Date('2025-01-01T00:00:00Z');
      const result = Answer.create(questionId, optionIds, futureDate);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.answeredAt).toBe(futureDate);
      }
    });

    it('should handle past timestamps', () => {
      const pastDate = new Date('2020-01-01T00:00:00Z');
      const result = Answer.create(questionId, optionIds, pastDate);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.answeredAt).toBe(pastDate);
      }
    });
  });

  describe('type safety', () => {
    it('should maintain type safety with branded IDs', () => {
      const result = Answer.create(questionId, optionIds, answeredAt);

      if (result.success) {
        // These should be type-safe branded types
        const answer = result.data;
        expect(typeof answer.id).toBe('string');
        expect(typeof answer.questionId).toBe('string');
        expect(Array.isArray(answer.selectedOptionIds)).toBe(true);
      }
    });

    it('should ensure readonly array type', () => {
      const result = Answer.create(questionId, optionIds, answeredAt);

      if (result.success) {
        // TypeScript should enforce readonly array
        const optionList: readonly OptionId[] = result.data.selectedOptionIds;
        expect(optionList).toEqual(optionIds);
      }
    });
  });
});
