/**
 * Admin Route Error Handler Utility
 * @fileoverview Consolidated error handling for admin routes to eliminate code duplication
 */

import { AppError } from '@api/shared/errors';
import type { ContentfulStatusCode } from 'hono/utils/http-status';

/**
 * Consolidated error handler for admin routes
 * Handles both AppError instances and generic errors with consistent format
 *
 * @param error - The error to handle (AppError or generic error)
 * @returns Formatted error response with appropriate status code
 */
export function handleAdminRouteError(error: unknown): {
  response: {
    success: false;
    error: {
      code: string;
      message: string;
    };
  };
  status: ContentfulStatusCode;
} {
  // Leverage AppError infrastructure for proper status code mapping
  if (error instanceof AppError) {
    return {
      response: {
        success: false,
        error: {
          code: error.code,
          message: error.message,
        },
      },
      status: error.statusCode as ContentfulStatusCode,
    };
  }

  // Fallback for non-AppError instances
  return {
    response: {
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: error instanceof Error ? error.message : 'An unexpected error occurred',
      },
    },
    status: 500,
  };
}
