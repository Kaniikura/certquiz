/**
 * Shared error mapping utilities for user routes
 * @fileoverview Provides consistent error response mapping across all user endpoints
 */

import { ValidationError } from '@api/shared/errors';
import { EmailAlreadyTakenError, UserNotFoundError, UsernameAlreadyTakenError } from './errors';

export interface ErrorResponse {
  status: number;
  body: {
    success: false;
    error: {
      code: string;
      message: string;
      field?: string;
    };
  };
}

/**
 * Maps domain errors to HTTP error responses
 * @param error - The error to map
 * @returns Error response with status code and body
 */
export function mapUserError(error: Error): ErrorResponse {
  // Validation errors
  if (error.name === 'ValidationError' || error instanceof ValidationError) {
    return {
      status: 400,
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
      status: 404,
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
      status: 409,
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
      status: 409,
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
  return {
    status: 500,
    body: {
      success: false,
      error: {
        code: 'REPOSITORY_ERROR',
        message: 'Internal server error',
      },
    },
  };
}
