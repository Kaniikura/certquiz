/**
 * Shared error mapping utilities for user routes
 * @fileoverview Provides consistent error response mapping across all user endpoints
 */

import { ValidationError } from '@api/shared/errors';
import { HttpStatus } from '@api/shared/http-status';
import type { ErrorResponse } from '@api/shared/types/error-response';
import { EmailAlreadyTakenError, UserNotFoundError, UsernameAlreadyTakenError } from './errors';

/**
 * Maps domain errors to HTTP error responses
 * @param error - The error to map
 * @returns Error response with status code and body
 */
export function mapUserError(error: Error): ErrorResponse {
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

  // User not found
  if (error instanceof UserNotFoundError) {
    return {
      status: HttpStatus.NOT_FOUND,
      body: {
        success: false,
        error: {
          code: 'USER_NOT_FOUND',
          message: error.message,
        },
      },
    };
  }

  // Email already taken
  if (error instanceof EmailAlreadyTakenError) {
    return {
      status: HttpStatus.CONFLICT,
      body: {
        success: false,
        error: {
          code: 'EMAIL_ALREADY_TAKEN',
          message: error.message,
          field: 'email',
        },
      },
    };
  }

  // Username already taken
  if (error instanceof UsernameAlreadyTakenError) {
    return {
      status: HttpStatus.CONFLICT,
      body: {
        success: false,
        error: {
          code: 'USERNAME_ALREADY_TAKEN',
          message: error.message,
          field: 'username',
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
        code: 'REPOSITORY_ERROR',
        message: isDev ? error.message : 'Internal server error',
        // Include stack trace in development for debugging
        ...(isDev && { details: error.stack }),
      },
    },
  };
}
