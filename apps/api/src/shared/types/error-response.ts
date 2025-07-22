/**
 * Shared error response types
 * @fileoverview Common error response interfaces used across the application
 */

/**
 * Standard error response structure for HTTP API endpoints
 * Provides consistent error formatting across all features
 */
export interface ErrorResponse {
  status: number;
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
