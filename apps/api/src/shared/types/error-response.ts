/**
 * Shared error response types
 * @fileoverview Common error response interfaces used across the application
 */

/**
 * Supported HTTP status codes for error responses
 * These match the SupportedStatusCode type from route-utils to ensure type safety
 */
type ErrorStatusCode = 400 | 403 | 404 | 409 | 422 | 500;

/**
 * Standard error response structure for HTTP API endpoints
 * Provides consistent error formatting across all features
 */
export interface ErrorResponse {
  status: ErrorStatusCode;
  body: {
    success: false;
    error: {
      code: string;
      message: string;
      field?: string;
      details?: string; // Include error details in development
    };
  };
}
