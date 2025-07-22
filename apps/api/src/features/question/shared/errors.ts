/**
 * Question domain-specific errors
 * @fileoverview Error classes for the Question bounded context
 */

import { AppError } from '@api/shared/errors';

/**
 * Error thrown when a question is not found
 */
export class QuestionNotFoundError extends AppError {
  constructor(questionId: string) {
    super(`Question not found: ${questionId}`, 'QUESTION_NOT_FOUND', 404);
    this.name = 'QuestionNotFoundError';
  }
}

/**
 * Error thrown when there's a version conflict during question update
 */
export class QuestionVersionConflictError extends AppError {
  constructor(questionId: string, expectedVersion: number, actualVersion: number) {
    super(
      `Version conflict for question ${questionId}. Expected version ${expectedVersion}, but current version is ${actualVersion}`,
      'QUESTION_VERSION_CONFLICT',
      409
    );
    this.name = 'QuestionVersionConflictError';
  }
}

/**
 * Error thrown when question data is invalid
 */
export class InvalidQuestionDataError extends AppError {
  constructor(message: string) {
    super(message, 'INVALID_QUESTION_DATA', 400);
    this.name = 'InvalidQuestionDataError';
  }
}

/**
 * Error thrown when user doesn't have access to a question
 */
export class QuestionAccessDeniedError extends AppError {
  constructor(questionId: string, reason: string) {
    super(`Access denied to question ${questionId}: ${reason}`, 'QUESTION_ACCESS_DENIED', 403);
    this.name = 'QuestionAccessDeniedError';
  }
}

/**
 * Error thrown when repository operations fail
 */
export class QuestionRepositoryError extends AppError {
  constructor(operation: string, cause: string) {
    super(`Question repository ${operation} failed: ${cause}`, 'QUESTION_REPOSITORY_ERROR', 500);
    this.name = 'QuestionRepositoryError';
  }
}

/**
 * Error thrown when repository configuration is invalid
 */
export class QuestionRepositoryConfigurationError extends AppError {
  constructor(message: string) {
    super(
      `Question repository configuration error: ${message}`,
      'QUESTION_REPOSITORY_CONFIG_ERROR',
      500
    );
    this.name = 'QuestionRepositoryConfigurationError';
  }
}
