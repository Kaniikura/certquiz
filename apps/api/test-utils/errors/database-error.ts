/**
 * Database error type guards and utilities for testing
 */

/**
 * Database connection error type
 */
export interface DatabaseError extends Error {
  code?: string;
  detail?: string;
  hint?: string;
}

/**
 * Type guard for database errors
 * @param error - Error to check
 * @returns true if error appears to be a database error
 */
export function isDatabaseError(error: unknown): error is DatabaseError {
  return error instanceof Error && ('code' in error || 'detail' in error || 'hint' in error);
}
