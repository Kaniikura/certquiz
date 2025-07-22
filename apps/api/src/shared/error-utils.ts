/**
 * Shared error utility functions
 * @fileoverview Provides common error handling utilities used across error mappers
 */

import type { ErrorResponse } from '@api/shared/types/error-response';
import { ValidationError } from './errors';
import { HttpStatus } from './http-status';

/**
 * Type guard to check if an error is a ValidationError
 *
 * This function provides a safe instanceof check for ValidationError instances.
 * All ValidationError instances in the codebase properly extend the ValidationError
 * class from @api/shared/errors. This has been verified across the entire codebase
 * and is tested in error-mapper.test.ts files.
 *
 * @param error - The error to check
 * @returns True if the error is a ValidationError instance
 */
export function isValidationError(error: unknown): error is ValidationError {
  return error instanceof ValidationError;
}

/**
 * Creates a validation error response
 *
 * This function creates a standardized validation error response that can be
 * used across all error mappers to ensure consistency.
 *
 * @param error - The ValidationError instance
 * @returns Standardized error response with BAD_REQUEST status
 */
export function createValidationErrorResponse(error: ValidationError): ErrorResponse {
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
