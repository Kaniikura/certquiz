/**
 * Shared route utilities for quiz feature
 * @fileoverview Common utilities for error mapping and route handling
 */

import { AuthorizationError } from '@api/shared/errors';
import { HttpStatus, type HttpStatusCode } from '@api/shared/http-status';
import type { Context } from 'hono';

/**
 * Union type of all supported HTTP status codes for error responses
 * Used for type-safe error handling in Hono routes
 */
type SupportedStatusCode = Extract<
  HttpStatusCode,
  | typeof HttpStatus.BAD_REQUEST
  | typeof HttpStatus.FORBIDDEN
  | typeof HttpStatus.NOT_FOUND
  | typeof HttpStatus.CONFLICT
  | typeof HttpStatus.UNPROCESSABLE_ENTITY
  | typeof HttpStatus.INTERNAL_SERVER_ERROR
>;

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
  { errorName: 'ValidationError', httpStatus: HttpStatus.BAD_REQUEST },
  {
    errorName: 'SessionNotFoundError',
    httpStatus: HttpStatus.NOT_FOUND,
    code: 'SESSION_NOT_FOUND',
  },

  // Start quiz errors
  {
    errorName: 'ActiveSessionError',
    httpStatus: HttpStatus.CONFLICT,
    code: 'ACTIVE_SESSION_EXISTS',
  },
  {
    errorName: 'InsufficientQuestionsError',
    httpStatus: HttpStatus.UNPROCESSABLE_ENTITY,
    code: 'INSUFFICIENT_QUESTIONS',
  },

  // Submit answer errors
  { errorName: 'QuizExpiredError', httpStatus: HttpStatus.CONFLICT, code: 'QUIZ_EXPIRED' },
  {
    errorName: 'QuizNotInProgressError',
    httpStatus: HttpStatus.CONFLICT,
    code: 'QUIZ_NOT_IN_PROGRESS',
  },
  {
    errorName: 'QuestionNotFoundError',
    httpStatus: HttpStatus.NOT_FOUND,
    code: 'QUESTION_NOT_FOUND',
  },
  {
    errorName: 'QuestionAlreadyAnsweredError',
    httpStatus: HttpStatus.CONFLICT,
    code: 'QUESTION_ALREADY_ANSWERED',
  },
  {
    errorName: 'InvalidOptionsError',
    httpStatus: HttpStatus.UNPROCESSABLE_ENTITY,
    code: 'INVALID_OPTIONS',
  },
  {
    errorName: 'OutOfOrderAnswerError',
    httpStatus: HttpStatus.UNPROCESSABLE_ENTITY,
    code: 'OUT_OF_ORDER_ANSWER',
  },
];

/**
 * Maps domain errors to HTTP responses
 * @param error - Domain error to map
 * @returns HTTP error response with status and body
 */
export function mapDomainErrorToHttp(error: Error): HttpErrorResponse {
  // Check for authorization errors using instanceof for type safety
  if (error instanceof AuthorizationError) {
    return {
      status: HttpStatus.FORBIDDEN,
      body: {
        error: error.message,
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
    status: HttpStatus.INTERNAL_SERVER_ERROR,
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
  if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
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

  // Return the response with the appropriate status code
  // Cast to satisfy Hono's type requirements
  return c.json(body, status as SupportedStatusCode);
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
