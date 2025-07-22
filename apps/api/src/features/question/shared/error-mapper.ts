/**
 * Shared error mapping utilities for question routes
 * @fileoverview Provides consistent error response mapping across all question endpoints
 */

import { ValidationError } from '@api/shared/errors';
import { HttpStatus } from '@api/shared/http-status';
import type { ErrorResponse } from '@api/shared/types/error-response';
import {
  InvalidQuestionDataError,
  QuestionAccessDeniedError,
  QuestionNotFoundError,
  QuestionRepositoryConfigurationError,
  QuestionRepositoryError,
  QuestionVersionConflictError,
} from './errors';

/**
 * Maps domain errors to HTTP error responses
 * @param error - The error to map
 * @returns Error response with status code and body
 */
export function mapQuestionError(error: Error): ErrorResponse {
  // Validation errors
  if (error instanceof ValidationError) {
    return {
      status: HttpStatus.BAD_REQUEST,
      body: {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: error.message,
        },
      },
    };
  }

  // Invalid question data
  if (error instanceof InvalidQuestionDataError) {
    return {
      status: HttpStatus.BAD_REQUEST,
      body: {
        success: false,
        error: {
          code: 'INVALID_QUESTION_DATA',
          message: error.message,
        },
      },
    };
  }

  // Question access denied
  if (error instanceof QuestionAccessDeniedError) {
    return {
      status: HttpStatus.FORBIDDEN,
      body: {
        success: false,
        error: {
          code: 'QUESTION_ACCESS_DENIED',
          message: error.message,
        },
      },
    };
  }

  // Question not found
  if (error instanceof QuestionNotFoundError) {
    return {
      status: HttpStatus.NOT_FOUND,
      body: {
        success: false,
        error: {
          code: 'QUESTION_NOT_FOUND',
          message: error.message,
        },
      },
    };
  }

  // Version conflict (optimistic locking)
  if (error instanceof QuestionVersionConflictError) {
    return {
      status: HttpStatus.CONFLICT,
      body: {
        success: false,
        error: {
          code: 'QUESTION_VERSION_CONFLICT',
          message: error.message,
        },
      },
    };
  }

  // Repository configuration error
  if (error instanceof QuestionRepositoryConfigurationError) {
    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      body: {
        success: false,
        error: {
          code: 'REPOSITORY_CONFIG_ERROR',
          message: 'Repository configuration error',
          // Don't expose internal config details to client
        },
      },
    };
  }

  // Repository errors
  if (error instanceof QuestionRepositoryError) {
    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      body: {
        success: false,
        error: {
          code: 'REPOSITORY_ERROR',
          message: 'Database operation failed',
          // Don't expose internal database details to client
        },
      },
    };
  }

  // Default error response for unexpected errors
  // In development/testing, include error details for debugging
  const isDev = process.env.NODE_ENV !== 'production';
  return {
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    body: {
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: isDev ? error.message : 'Internal server error',
        // Include stack trace in development for debugging
        ...(isDev && { details: error.stack }),
      },
    },
  };
}
