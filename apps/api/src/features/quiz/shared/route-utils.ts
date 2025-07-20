/**
 * Shared route utilities for quiz feature
 * @fileoverview Common utilities for error mapping and route handling
 */

import type { Context } from 'hono';

/**
 * Error mapping configuration
 */
interface ErrorMapping {
  /** Error name to match */
  errorName: string;
  /** HTTP status code to return */
  httpStatus: number;
  /** Optional error code for response body */
  code?: string;
}

/**
 * HTTP error response structure
 */
interface HttpErrorResponse {
  /** HTTP status code */
  status: number;
  /** Response body */
  body: {
    error: string;
    code?: string;
  };
}

/**
 * Quiz feature error mappings
 * Maps domain errors to HTTP responses
 */
const quizErrorMappings: ErrorMapping[] = [
  // Common errors
  { errorName: 'ValidationError', httpStatus: 400 },
  { errorName: 'SessionNotFoundError', httpStatus: 404, code: 'SESSION_NOT_FOUND' },

  // Start quiz errors
  { errorName: 'ActiveSessionError', httpStatus: 409, code: 'ACTIVE_SESSION_EXISTS' },
  { errorName: 'InsufficientQuestionsError', httpStatus: 422, code: 'INSUFFICIENT_QUESTIONS' },

  // Submit answer errors
  { errorName: 'QuizExpiredError', httpStatus: 409, code: 'QUIZ_EXPIRED' },
  { errorName: 'QuizNotInProgressError', httpStatus: 409, code: 'QUIZ_NOT_IN_PROGRESS' },
  { errorName: 'QuestionNotFoundError', httpStatus: 404, code: 'QUESTION_NOT_FOUND' },
  { errorName: 'QuestionAlreadyAnsweredError', httpStatus: 409, code: 'QUESTION_ALREADY_ANSWERED' },
  { errorName: 'InvalidOptionsError', httpStatus: 422, code: 'INVALID_OPTIONS' },
  { errorName: 'OutOfOrderAnswerError', httpStatus: 422, code: 'OUT_OF_ORDER_ANSWER' },
];

/**
 * Maps domain errors to HTTP responses
 * @param error - Domain error to map
 * @returns HTTP error response with status and body
 */
export function mapDomainErrorToHttp(error: Error): HttpErrorResponse {
  // Check for authorization errors (special case)
  if (error.message.includes('Unauthorized')) {
    return {
      status: 403,
      body: {
        error: 'Unauthorized: Access denied',
        code: 'UNAUTHORIZED',
      },
    };
  }

  // Find mapping by error name
  const mapping = quizErrorMappings.find((m) => error.name === m.errorName);

  if (mapping) {
    return {
      status: mapping.httpStatus,
      body: {
        error: error.message,
        ...(mapping.code && { code: mapping.code }),
      },
    };
  }

  // Default to internal server error
  return {
    status: 500,
    body: {
      error: 'Internal server error',
    },
  };
}

/**
 * Creates a standardized error response
 * @param c - Hono context
 * @param error - Error to handle
 * @param logger - Logger instance for error logging
 * @param context - Additional context for logging
 * @returns HTTP response
 */
export function handleRouteError(
  c: Context,
  error: Error,
  logger: {
    warn: (msg: string, data: Record<string, unknown>) => void;
    error: (msg: string, data: Record<string, unknown>) => void;
  },
  context: Record<string, unknown>
) {
  const { status, body } = mapDomainErrorToHttp(error);

  // Log appropriately based on status
  if (status >= 500) {
    logger.error('Route handler error', {
      ...context,
      errorType: error.name,
      errorMessage: error.message,
      stack: error.stack,
    });
  } else {
    logger.warn('Request failed', {
      ...context,
      errorType: error.name,
      errorMessage: error.message,
    });
  }

  // Cast to specific status codes that Hono accepts
  switch (status) {
    case 400:
      return c.json(body, 400);
    case 403:
      return c.json(body, 403);
    case 404:
      return c.json(body, 404);
    case 409:
      return c.json(body, 409);
    case 422:
      return c.json(body, 422);
    default:
      return c.json(body, 500);
  }
}

/**
 * Creates a standardized success response
 * @param data - Response data
 * @returns Success response structure
 */
export function createSuccessResponse<T>(data: T) {
  return {
    success: true,
    data,
  };
}
