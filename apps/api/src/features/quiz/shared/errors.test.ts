/**
 * Tests for Quiz Domain Errors
 * @fileoverview Tests for domain error hierarchy and invariant violations
 */

import { describe, expect, it } from 'vitest';
import {
  ConcurrencyError,
  DuplicateQuestionError,
  IncompleteQuizError,
  InvalidAnswerError,
  InvalidOptionsError,
  InvalidQuestionCountError,
  InvalidQuestionReferenceError,
  InvalidTimeLimitError,
  OptimisticLockError,
  OutOfOrderAnswerError,
  QuestionAlreadyAnsweredError,
  QuestionCountMismatchError,
  QuestionNotInQuizError,
  QuizDomainError,
  QuizErrorCode,
  QuizExpiredError,
  QuizNotExpiredError,
  QuizNotInProgressError,
} from './errors';

describe('Quiz Domain Errors', () => {
  describe('QuizDomainError (base class)', () => {
    it('should extend Error with code', () => {
      const error = new InvalidAnswerError('Test message');

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(QuizDomainError);
      expect(error.message).toBe('Invalid answer: Test message');
      expect(error.name).toBe('InvalidAnswerError');
      expect(error.code).toBe(QuizErrorCode.INVALID_ANSWER);
    });

    it('should maintain stack trace', () => {
      const error = new InvalidAnswerError('Test message');

      expect(error.stack).toBeDefined();
      expect(error.stack).toContain('errors.test.ts');
    });

    it('should include error code', () => {
      const error = new InvalidQuestionCountError('Count must be positive');

      expect(error.code).toBe(QuizErrorCode.INVALID_QUESTION_COUNT);
      expect(typeof error.code).toBe('string');
    });
  });

  describe('InvalidQuestionCountError', () => {
    it('should create error with custom message', () => {
      const error = new InvalidQuestionCountError('Must be between 1 and 100');

      expect(error).toBeInstanceOf(QuizDomainError);
      expect(error.name).toBe('InvalidQuestionCountError');
      expect(error.message).toBe('Must be between 1 and 100');
      expect(error.code).toBe(QuizErrorCode.INVALID_QUESTION_COUNT);
    });

    it('should use default message when none provided', () => {
      const error = new InvalidQuestionCountError();

      expect(error.message).toBe('Invalid question count');
      expect(error.code).toBe(QuizErrorCode.INVALID_QUESTION_COUNT);
    });
  });

  describe('QuestionCountMismatchError', () => {
    it('should create error with expected and actual counts', () => {
      const error = new QuestionCountMismatchError(10, 5);

      expect(error).toBeInstanceOf(QuizDomainError);
      expect(error.name).toBe('QuestionCountMismatchError');
      expect(error.message).toBe('Question count mismatch: expected 10, got 5');
      expect(error.code).toBe(QuizErrorCode.QUESTION_COUNT_MISMATCH);
    });

    it('should handle zero counts', () => {
      const error = new QuestionCountMismatchError(5, 0);

      expect(error.message).toBe('Question count mismatch: expected 5, got 0');
    });
  });

  describe('DuplicateQuestionError', () => {
    it('should create error for duplicate questions', () => {
      const error = new DuplicateQuestionError();

      expect(error).toBeInstanceOf(QuizDomainError);
      expect(error.name).toBe('DuplicateQuestionError');
      expect(error.message).toBe('Duplicate question detected');
      expect(error.code).toBe(QuizErrorCode.DUPLICATE_QUESTION);
    });
  });

  describe('InvalidOptionsError', () => {
    it('should create error with invalid option list', () => {
      const invalidOptions = ['opt1', 'opt2', 'opt3'];
      const error = new InvalidOptionsError(invalidOptions);

      expect(error).toBeInstanceOf(QuizDomainError);
      expect(error.name).toBe('InvalidOptionsError');
      expect(error.message).toBe('Invalid options: opt1, opt2, opt3');
      expect(error.code).toBe(QuizErrorCode.INVALID_OPTIONS);
      expect(error.invalidOptions).toEqual(invalidOptions);
    });

    it('should handle single invalid option', () => {
      const error = new InvalidOptionsError(['single-option']);

      expect(error.message).toBe('Invalid options: single-option');
      expect(error.invalidOptions).toEqual(['single-option']);
    });

    it('should handle empty invalid options array', () => {
      const error = new InvalidOptionsError([]);

      expect(error.message).toBe('Invalid options: ');
      expect(error.invalidOptions).toEqual([]);
    });
  });

  describe('IncompleteQuizError', () => {
    it('should create error with unanswered count', () => {
      const error = new IncompleteQuizError(3);

      expect(error).toBeInstanceOf(QuizDomainError);
      expect(error.name).toBe('IncompleteQuizError');
      expect(error.message).toBe('Cannot complete quiz with 3 unanswered questions');
      expect(error.code).toBe(QuizErrorCode.INCOMPLETE_QUIZ);
      expect(error.unansweredCount).toBe(3);
    });

    it('should handle single unanswered question', () => {
      const error = new IncompleteQuizError(1);

      expect(error.message).toBe('Cannot complete quiz with 1 unanswered questions');
      expect(error.unansweredCount).toBe(1);
    });
  });

  describe('QuizNotInProgressError', () => {
    it('should create error for operations on non-active quiz', () => {
      const error = new QuizNotInProgressError();

      expect(error).toBeInstanceOf(QuizDomainError);
      expect(error.name).toBe('QuizNotInProgressError');
      expect(error.message).toBe('Quiz is not in progress');
      expect(error.code).toBe(QuizErrorCode.QUIZ_NOT_IN_PROGRESS);
    });
  });

  describe('QuizExpiredError', () => {
    it('should create error for expired quiz operations', () => {
      const error = new QuizExpiredError();

      expect(error).toBeInstanceOf(QuizDomainError);
      expect(error.name).toBe('QuizExpiredError');
      expect(error.message).toBe('Quiz has expired');
      expect(error.code).toBe(QuizErrorCode.QUIZ_EXPIRED);
    });
  });

  describe('QuizNotExpiredError', () => {
    it('should create error for premature expiry operations', () => {
      const error = new QuizNotExpiredError();

      expect(error).toBeInstanceOf(QuizDomainError);
      expect(error.name).toBe('QuizNotExpiredError');
      expect(error.message).toBe('Quiz has not expired yet');
      expect(error.code).toBe(QuizErrorCode.QUIZ_NOT_EXPIRED);
    });
  });

  describe('QuestionAlreadyAnsweredError', () => {
    it('should create error for duplicate answers', () => {
      const error = new QuestionAlreadyAnsweredError();

      expect(error).toBeInstanceOf(QuizDomainError);
      expect(error.name).toBe('QuestionAlreadyAnsweredError');
      expect(error.message).toBe('Question already answered');
      expect(error.code).toBe(QuizErrorCode.QUESTION_ALREADY_ANSWERED);
    });
  });

  describe('InvalidTimeLimitError', () => {
    it('should create error for invalid time limits', () => {
      const error = new InvalidTimeLimitError();

      expect(error).toBeInstanceOf(QuizDomainError);
      expect(error.name).toBe('InvalidTimeLimitError');
      expect(error.message).toBe('Time limit must be at least 60 seconds');
      expect(error.code).toBe(QuizErrorCode.INVALID_TIME_LIMIT);
    });
  });

  describe('OutOfOrderAnswerError', () => {
    it('should create error with expected and actual indices', () => {
      const error = new OutOfOrderAnswerError(2, 5);

      expect(error).toBeInstanceOf(QuizDomainError);
      expect(error.name).toBe('OutOfOrderAnswerError');
      expect(error.message).toBe('Expected question at index 2, got 5');
      expect(error.code).toBe(QuizErrorCode.OUT_OF_ORDER_ANSWER);
      expect(error.expectedIndex).toBe(2);
      expect(error.actualIndex).toBe(5);
    });

    it('should handle zero-based indexing', () => {
      const error = new OutOfOrderAnswerError(0, 3);

      expect(error.message).toBe('Expected question at index 0, got 3');
      expect(error.expectedIndex).toBe(0);
      expect(error.actualIndex).toBe(3);
    });
  });

  describe('InvalidAnswerError', () => {
    it('should create error with validation details', () => {
      const error = new InvalidAnswerError('Answer must include at least one option');

      expect(error).toBeInstanceOf(QuizDomainError);
      expect(error.name).toBe('InvalidAnswerError');
      expect(error.message).toBe('Invalid answer: Answer must include at least one option');
      expect(error.code).toBe(QuizErrorCode.INVALID_ANSWER);
    });

    it('should handle duplicate option errors', () => {
      const error = new InvalidAnswerError('Answer contains duplicate option selections');

      expect(error.message).toBe('Invalid answer: Answer contains duplicate option selections');
    });
  });

  describe('InvalidQuestionReferenceError', () => {
    it('should create error for reference mismatches', () => {
      const error = new InvalidQuestionReferenceError();

      expect(error).toBeInstanceOf(QuizDomainError);
      expect(error.name).toBe('InvalidQuestionReferenceError');
      expect(error.message).toBe('Question reference does not match the question ID');
      expect(error.code).toBe(QuizErrorCode.INVALID_QUESTION_REFERENCE);
    });
  });

  describe('QuestionNotInQuizError', () => {
    it('should create error with default message', () => {
      const error = new QuestionNotInQuizError();

      expect(error).toBeInstanceOf(QuizDomainError);
      expect(error.name).toBe('QuestionNotInQuizError');
      expect(error.message).toBe('Question is not part of this quiz');
      expect(error.code).toBe(QuizErrorCode.QUESTION_NOT_IN_QUIZ);
    });

    it('should create error with custom message', () => {
      const error = new QuestionNotInQuizError('Question q123 not found in quiz session');

      expect(error.message).toBe('Question q123 not found in quiz session');
      expect(error.code).toBe(QuizErrorCode.QUESTION_NOT_IN_QUIZ);
    });
  });

  describe('Infrastructure Errors', () => {
    describe('OptimisticLockError', () => {
      it('should create lock error', () => {
        const error = new OptimisticLockError('Version conflict detected');

        expect(error).toBeInstanceOf(Error);
        expect(error.name).toBe('OptimisticLockError');
        expect(error.message).toBe('Version conflict detected');
      });
    });

    describe('ConcurrencyError', () => {
      it('should create concurrency error', () => {
        const error = new ConcurrencyError('Concurrent modification detected');

        expect(error).toBeInstanceOf(Error);
        expect(error.name).toBe('ConcurrencyError');
        expect(error.message).toBe('Concurrent modification detected');
      });
    });
  });

  describe('Error hierarchy and inheritance', () => {
    it('should maintain proper inheritance chain', () => {
      const domainErrors = [
        new InvalidQuestionCountError('test'),
        new QuestionCountMismatchError(5, 3),
        new DuplicateQuestionError(),
        new InvalidOptionsError(['opt1']),
        new IncompleteQuizError(2),
        new QuizNotInProgressError(),
        new QuizExpiredError(),
        new QuizNotExpiredError(),
        new QuestionAlreadyAnsweredError(),
        new InvalidTimeLimitError(),
        new OutOfOrderAnswerError(1, 3),
        new InvalidAnswerError('test'),
        new InvalidQuestionReferenceError(),
        new QuestionNotInQuizError(),
      ];

      domainErrors.forEach((error) => {
        expect(error).toBeInstanceOf(Error);
        expect(error).toBeInstanceOf(QuizDomainError);
        expect(typeof error.message).toBe('string');
        expect(typeof error.name).toBe('string');
        expect(typeof error.code).toBe('string');
        expect(error.stack).toBeDefined();
      });
    });

    it('should have unique error names', () => {
      const errors = [
        new InvalidQuestionCountError('test'),
        new QuestionCountMismatchError(5, 3),
        new DuplicateQuestionError(),
        new InvalidOptionsError(['opt1']),
        new IncompleteQuizError(2),
        new QuizNotInProgressError(),
        new QuizExpiredError(),
        new OutOfOrderAnswerError(1, 3),
        new InvalidAnswerError('test'),
      ];

      const names = errors.map((error) => error.name);
      const uniqueNames = new Set(names);

      expect(uniqueNames.size).toBe(names.length);
    });

    it('should support instanceof checks for error handling', () => {
      const questionCountError = new InvalidQuestionCountError('test');
      const answerError = new InvalidAnswerError('test');
      const orderError = new OutOfOrderAnswerError(1, 2);

      // Should be able to distinguish between error types
      expect(questionCountError instanceof InvalidQuestionCountError).toBe(true);
      expect(questionCountError instanceof InvalidAnswerError).toBe(false);

      expect(answerError instanceof InvalidAnswerError).toBe(true);
      expect(answerError instanceof InvalidQuestionCountError).toBe(false);

      expect(orderError instanceof OutOfOrderAnswerError).toBe(true);
      expect(orderError instanceof InvalidAnswerError).toBe(false);
    });
  });

  describe('Error codes', () => {
    it('should have consistent error codes', () => {
      const errorCodeTests = [
        { error: new InvalidQuestionCountError(), code: QuizErrorCode.INVALID_QUESTION_COUNT },
        {
          error: new QuestionCountMismatchError(5, 3),
          code: QuizErrorCode.QUESTION_COUNT_MISMATCH,
        },
        { error: new DuplicateQuestionError(), code: QuizErrorCode.DUPLICATE_QUESTION },
        { error: new InvalidOptionsError(['opt1']), code: QuizErrorCode.INVALID_OPTIONS },
        { error: new IncompleteQuizError(2), code: QuizErrorCode.INCOMPLETE_QUIZ },
        { error: new QuizNotInProgressError(), code: QuizErrorCode.QUIZ_NOT_IN_PROGRESS },
        { error: new QuizExpiredError(), code: QuizErrorCode.QUIZ_EXPIRED },
        {
          error: new QuestionAlreadyAnsweredError(),
          code: QuizErrorCode.QUESTION_ALREADY_ANSWERED,
        },
        { error: new InvalidTimeLimitError(), code: QuizErrorCode.INVALID_TIME_LIMIT },
        { error: new OutOfOrderAnswerError(1, 3), code: QuizErrorCode.OUT_OF_ORDER_ANSWER },
        { error: new InvalidAnswerError('test'), code: QuizErrorCode.INVALID_ANSWER },
        {
          error: new InvalidQuestionReferenceError(),
          code: QuizErrorCode.INVALID_QUESTION_REFERENCE,
        },
        { error: new QuestionNotInQuizError(), code: QuizErrorCode.QUESTION_NOT_IN_QUIZ },
      ];

      errorCodeTests.forEach(({ error, code }) => {
        expect(error.code).toBe(code);
      });
    });

    it('should have string error code values', () => {
      const codes = Object.values(QuizErrorCode);

      codes.forEach((code) => {
        expect(typeof code).toBe('string');
        expect(code.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Real-world error scenarios', () => {
    it('should handle quiz configuration validation errors', () => {
      const scenarios = [
        {
          error: new InvalidQuestionCountError('Count cannot be zero'),
          scenario: 'zero questions',
        },
        {
          error: new InvalidQuestionCountError('Count exceeds maximum of 100'),
          scenario: 'too many questions',
        },
        { error: new InvalidTimeLimitError(), scenario: 'invalid time limit' },
        { error: new QuestionCountMismatchError(10, 5), scenario: 'count mismatch' },
      ];

      scenarios.forEach(({ error }) => {
        expect(error).toBeInstanceOf(QuizDomainError);
        expect(error.message).toBeTruthy();
        expect(error.code).toBeTruthy();
      });
    });

    it('should handle quiz state violation errors', () => {
      const stateErrors = [
        new QuizNotInProgressError(),
        new QuizExpiredError(),
        new QuizNotExpiredError(),
        new QuestionAlreadyAnsweredError(),
      ];

      stateErrors.forEach((error) => {
        expect(error).toBeInstanceOf(QuizDomainError);
        expect(error.message).toMatch(/quiz|question|progress|expired|answered/i);
      });
    });

    it('should handle answer validation errors', () => {
      const answerErrors = [
        new InvalidAnswerError('No options selected'),
        new InvalidOptionsError(['invalid-opt-1', 'invalid-opt-2']),
        new OutOfOrderAnswerError(0, 5),
        new InvalidQuestionReferenceError(),
      ];

      answerErrors.forEach((error) => {
        expect(error).toBeInstanceOf(QuizDomainError);
        expect(error.message).toBeTruthy();
        expect(error.code).toBeTruthy();
      });
    });
  });
});
