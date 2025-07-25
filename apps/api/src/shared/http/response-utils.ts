/**
 * HTTP Response Utilities
 *
 * Provides consistent response formatting across the API
 * to ensure uniform structure and reduce code duplication.
 */

import type { Context } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';

/**
 * Standard API success response structure
 */
interface _ApiSuccessResponse<T = unknown> {
  success: true;
  data: T;
}

/**
 * Standard API error response structure
 */
interface _ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

/**
 * Create a success response
 *
 * @param c - Hono context
 * @param data - Response data
 * @param status - HTTP status code (default: 200)
 * @returns Hono response
 */
export function successResponse<T>(c: Context, data: T, status = 200): Response {
  const response: _ApiSuccessResponse<T> = {
    success: true,
    data,
  };
  // Hono's json method accepts number but TypeScript's strict types need a cast
  return c.json(response, status as ContentfulStatusCode);
}

/**
 * Create an error response
 *
 * @param c - Hono context
 * @param code - Error code for client handling
 * @param message - Human-readable error message
 * @param status - HTTP status code
 * @param details - Optional error details
 * @returns Hono response
 */
export function errorResponse(
  c: Context,
  code: string,
  message: string,
  status = 500,
  details?: unknown
): Response {
  const response: _ApiErrorResponse = {
    success: false,
    error: {
      code,
      message,
      ...(details !== undefined && { details }),
    },
  };
  // Hono's json method accepts number but TypeScript's strict types need a cast
  return c.json(response, status as ContentfulStatusCode);
}

/**
 * Create a validation error response
 *
 * @param c - Hono context
 * @param message - Validation error message
 * @param details - Optional validation details
 * @returns Hono response with 400 status
 */
export function validationErrorResponse(c: Context, message: string, details?: unknown): Response {
  return errorResponse(c, 'VALIDATION_ERROR', message, 400, details);
}

/**
 * Create an authentication error response
 *
 * @param c - Hono context
 * @param message - Authentication error message (default: 'Authentication required')
 * @returns Hono response with 401 status
 */
export function authErrorResponse(c: Context, message = 'Authentication required'): Response {
  return errorResponse(c, 'AUTH_ERROR', message, 401);
}

/**
 * Create a not found error response
 *
 * @param c - Hono context
 * @param resource - Resource type that was not found
 * @returns Hono response with 404 status
 */
export function notFoundResponse(c: Context, resource: string): Response {
  return errorResponse(c, 'NOT_FOUND', `${resource} not found`, 404);
}

/**
 * Create an internal server error response
 *
 * @param c - Hono context
 * @param message - Error message (default: 'Internal server error')
 * @returns Hono response with 500 status
 */
export function internalErrorResponse(c: Context, message = 'Internal server error'): Response {
  return errorResponse(c, 'INTERNAL_ERROR', message, 500);
}
