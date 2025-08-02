/**
 * Quiz Domain Error Mapper
 *
 * Centralized error mapping for quiz-related routes to eliminate duplication
 */

import { createErrorMapper } from '@api/shared/route';
import type { ContentfulStatusCode } from 'hono/utils/http-status';

/**
 * Error mapping type definition
 */
type ErrorMapping = {
  errorName: string;
  status: ContentfulStatusCode;
  code: string;
};

/**
 * Common quiz domain error mappings
 * Note: This comprehensive list documents all possible quiz domain errors.
 * Individual route handlers use specific subsets of these mappings.
 */
export const quizDomainErrorMappings: ErrorMapping[] = [
  // Session errors
  {
    errorName: 'SessionNotFoundError',
    status: 404,
    code: 'SESSION_NOT_FOUND',
  },
  {
    errorName: 'ActiveSessionError',
    status: 409,
    code: 'ACTIVE_SESSION_EXISTS',
  },
  {
    errorName: 'SessionExpiredError',
    status: 410,
    code: 'SESSION_EXPIRED',
  },

  // Quiz state errors
  { errorName: 'QuizExpiredError', status: 409, code: 'QUIZ_EXPIRED' },
  {
    errorName: 'QuizNotInProgressError',
    status: 409,
    code: 'QUIZ_NOT_IN_PROGRESS',
  },
  {
    errorName: 'QuizAlreadyCompletedError',
    status: 409,
    code: 'QUIZ_ALREADY_COMPLETED',
  },

  // Question errors
  {
    errorName: 'QuestionNotFoundError',
    status: 404,
    code: 'QUESTION_NOT_FOUND',
  },
  {
    errorName: 'QuestionAlreadyAnsweredError',
    status: 409,
    code: 'QUESTION_ALREADY_ANSWERED',
  },
  {
    errorName: 'InvalidOptionsError',
    status: 422,
    code: 'INVALID_OPTIONS',
  },
  {
    errorName: 'OutOfOrderAnswerError',
    status: 422,
    code: 'OUT_OF_ORDER_ANSWER',
  },

  // Resource errors
  {
    errorName: 'InsufficientQuestionsError',
    status: 422,
    code: 'INSUFFICIENT_QUESTIONS',
  },
  {
    errorName: 'InvalidQuestionTypeError',
    status: 422,
    code: 'INVALID_QUESTION_TYPE',
  },

  // Access errors
  {
    errorName: 'UnauthorizedAccessError',
    status: 403,
    code: 'UNAUTHORIZED',
  },
  {
    errorName: 'PremiumAccessRequiredError',
    status: 403,
    code: 'PREMIUM_ACCESS_REQUIRED',
  },

  // State errors
  { errorName: 'InvalidStateError', status: 400, code: 'INVALID_STATE' },
  {
    errorName: 'InvalidTransitionError',
    status: 409,
    code: 'INVALID_TRANSITION',
  },

  // Infrastructure errors
  {
    errorName: 'QuizRepositoryError',
    status: 500,
    code: 'QUIZ_REPOSITORY_ERROR',
  },
];

/**
 * Specific error mappers for quiz route types
 */

/**
 * Start quiz specific errors
 */
const startQuizErrorMappings: ErrorMapping[] = [
  { errorName: 'ActiveSessionError', status: 409, code: 'ACTIVE_SESSION_EXISTS' },
  { errorName: 'InsufficientQuestionsError', status: 422, code: 'INSUFFICIENT_QUESTIONS' },
  { errorName: 'InvalidExamTypeError', status: 422, code: 'INVALID_EXAM_TYPE' },
  { errorName: 'PremiumAccessRequiredError', status: 403, code: 'PREMIUM_ACCESS_REQUIRED' },
];

export const mapStartQuizError = createErrorMapper(startQuizErrorMappings);

/**
 * Submit answer specific errors
 */
const submitAnswerErrorMappings: ErrorMapping[] = [
  { errorName: 'SessionNotFoundError', status: 404, code: 'SESSION_NOT_FOUND' },
  { errorName: 'QuestionNotFoundError', status: 404, code: 'QUESTION_NOT_FOUND' },
  { errorName: 'QuizExpiredError', status: 409, code: 'QUIZ_EXPIRED' },
  { errorName: 'QuizNotInProgressError', status: 409, code: 'QUIZ_NOT_IN_PROGRESS' },
  { errorName: 'QuestionAlreadyAnsweredError', status: 409, code: 'QUESTION_ALREADY_ANSWERED' },
  { errorName: 'InvalidOptionsError', status: 422, code: 'INVALID_OPTIONS' },
  { errorName: 'OutOfOrderAnswerError', status: 422, code: 'OUT_OF_ORDER_ANSWER' },
  { errorName: 'UnauthorizedAccessError', status: 403, code: 'UNAUTHORIZED' },
];

export const mapSubmitAnswerError = createErrorMapper(submitAnswerErrorMappings);

/**
 * Get results specific errors
 */
const getResultsErrorMappings: ErrorMapping[] = [
  { errorName: 'SessionNotFoundError', status: 404, code: 'SESSION_NOT_FOUND' },
  { errorName: 'QuizNotCompletedError', status: 409, code: 'QUIZ_NOT_COMPLETED' },
  { errorName: 'UnauthorizedAccessError', status: 403, code: 'UNAUTHORIZED' },
];

export const mapGetResultsError = createErrorMapper(getResultsErrorMappings);

/**
 * Complete quiz specific errors
 */
const completeQuizErrorMappings: ErrorMapping[] = [
  { errorName: 'SessionNotFoundError', status: 404, code: 'SESSION_NOT_FOUND' },
  { errorName: 'AuthorizationError', status: 403, code: 'UNAUTHORIZED' },
  { errorName: 'UserNotFoundError', status: 404, code: 'USER_NOT_FOUND' },
  { errorName: 'QuizNotCompletedError', status: 409, code: 'QUIZ_NOT_COMPLETED' },
];

export const mapCompleteQuizError = createErrorMapper(completeQuizErrorMappings);
