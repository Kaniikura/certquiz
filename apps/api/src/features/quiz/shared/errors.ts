/**
 * Domain errors for Quiz bounded context
 * @fileoverview Comprehensive error hierarchy for quiz domain operations
 */

import { AppError } from '@api/shared/errors';

export enum QuizErrorCode {
  // State errors
  QUIZ_NOT_IN_PROGRESS = 'QUIZ_NOT_IN_PROGRESS',
  QUIZ_EXPIRED = 'QUIZ_EXPIRED',
  QUIZ_NOT_EXPIRED = 'QUIZ_NOT_EXPIRED',

  // Answer errors
  QUESTION_NOT_FOUND = 'QUESTION_NOT_FOUND',
  QUESTION_NOT_IN_QUIZ = 'QUESTION_NOT_IN_QUIZ',
  QUESTION_ALREADY_ANSWERED = 'QUESTION_ALREADY_ANSWERED',
  INVALID_OPTIONS = 'INVALID_OPTIONS',
  INVALID_ANSWER = 'INVALID_ANSWER',
  INVALID_QUESTION_REFERENCE = 'INVALID_QUESTION_REFERENCE',
  OUT_OF_ORDER_ANSWER = 'OUT_OF_ORDER_ANSWER',

  // Completion errors
  INCOMPLETE_QUIZ = 'INCOMPLETE_QUIZ',
  QUIZ_NOT_COMPLETED = 'QUIZ_NOT_COMPLETED',

  // Configuration errors
  INVALID_QUESTION_COUNT = 'INVALID_QUESTION_COUNT',
  QUESTION_COUNT_MISMATCH = 'QUESTION_COUNT_MISMATCH',
  DUPLICATE_QUESTION = 'DUPLICATE_QUESTION',
  INVALID_TIME_LIMIT = 'INVALID_TIME_LIMIT',
}

export abstract class QuizDomainError extends Error {
  constructor(
    message: string,
    public readonly code: QuizErrorCode
  ) {
    super(message);
    this.name = this.constructor.name;
  }
}

// Concrete error implementations
export class InvalidQuestionCountError extends QuizDomainError {
  constructor(message?: string) {
    super(message || 'Invalid question count', QuizErrorCode.INVALID_QUESTION_COUNT);
  }
}

export class QuestionCountMismatchError extends QuizDomainError {
  constructor(expected: number, actual: number) {
    super(
      `Question count mismatch: expected ${expected}, got ${actual}`,
      QuizErrorCode.QUESTION_COUNT_MISMATCH
    );
  }
}

export class DuplicateQuestionError extends QuizDomainError {
  constructor() {
    super('Duplicate question detected', QuizErrorCode.DUPLICATE_QUESTION);
  }
}

export class InvalidOptionsError extends QuizDomainError {
  constructor(public readonly invalidOptions: string[]) {
    super(`Invalid options: ${invalidOptions.join(', ')}`, QuizErrorCode.INVALID_OPTIONS);
  }
}

export class IncompleteQuizError extends QuizDomainError {
  constructor(public readonly unansweredCount: number) {
    super(
      `Cannot complete quiz with ${unansweredCount} unanswered questions`,
      QuizErrorCode.INCOMPLETE_QUIZ
    );
  }
}

export class QuizNotCompletedError extends QuizDomainError {
  constructor(sessionId: string, currentState: string) {
    super(
      `Quiz session ${sessionId} must be in COMPLETED state but is currently ${currentState}. ` +
        'Please ensure all questions are answered and the quiz is finished before requesting completion.',
      QuizErrorCode.QUIZ_NOT_COMPLETED
    );
  }
}

export class QuizNotInProgressError extends QuizDomainError {
  constructor() {
    super('Quiz is not in progress', QuizErrorCode.QUIZ_NOT_IN_PROGRESS);
  }
}

export class QuizExpiredError extends QuizDomainError {
  constructor() {
    super('Quiz has expired', QuizErrorCode.QUIZ_EXPIRED);
  }
}

export class QuizNotExpiredError extends QuizDomainError {
  constructor() {
    super('Quiz has not expired yet', QuizErrorCode.QUIZ_NOT_EXPIRED);
  }
}

export class QuestionNotFoundInQuizError extends QuizDomainError {
  constructor() {
    super('Question not found in quiz', QuizErrorCode.QUESTION_NOT_FOUND);
  }
}

export class QuestionAlreadyAnsweredError extends QuizDomainError {
  constructor() {
    super('Question already answered', QuizErrorCode.QUESTION_ALREADY_ANSWERED);
  }
}

export class InvalidTimeLimitError extends QuizDomainError {
  constructor() {
    super('Time limit must be at least 60 seconds', QuizErrorCode.INVALID_TIME_LIMIT);
  }
}

export class OutOfOrderAnswerError extends QuizDomainError {
  constructor(
    public readonly expectedIndex: number,
    public readonly actualIndex: number
  ) {
    super(
      `Expected question at index ${expectedIndex}, got ${actualIndex}`,
      QuizErrorCode.OUT_OF_ORDER_ANSWER
    );
  }
}

export class InvalidAnswerError extends QuizDomainError {
  constructor(details: string) {
    super(`Invalid answer: ${details}`, QuizErrorCode.INVALID_ANSWER);
  }
}

export class InvalidQuestionReferenceError extends QuizDomainError {
  constructor() {
    super(
      'Question reference does not match the question ID',
      QuizErrorCode.INVALID_QUESTION_REFERENCE
    );
  }
}

export class QuestionNotInQuizError extends QuizDomainError {
  constructor(message?: string) {
    super(message || 'Question is not part of this quiz', QuizErrorCode.QUESTION_NOT_IN_QUIZ);
  }
}

/**
 * Error thrown when a quiz session is not found
 */
export class SessionNotFoundError extends Error {
  constructor(sessionId: string) {
    super(`Quiz session not found: ${sessionId}`);
    this.name = 'SessionNotFoundError';
  }
}

// Infrastructure errors
export class OptimisticLockError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OptimisticLockError';
  }
}

export class ConcurrencyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConcurrencyError';
  }
}

/**
 * Error thrown when repository operations fail
 */
export class QuizRepositoryError extends AppError {
  constructor(operation: string, cause: string) {
    super(`Quiz repository ${operation} failed: ${cause}`, 'QUIZ_REPOSITORY_ERROR', 500);
    this.name = 'QuizRepositoryError';
  }
}
