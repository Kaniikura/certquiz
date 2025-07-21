/**
 * PostgreSQL error handling utilities
 * @fileoverview Helpers for detecting and handling specific PostgreSQL errors
 */

import { EmailAlreadyTakenError, UsernameAlreadyTakenError } from './errors';

/**
 * PostgreSQL error interface
 * Drizzle wraps database errors but preserves the original error properties
 */
export interface PostgresError extends Error {
  code?: string;
  constraint?: string;
  detail?: string;
  table?: string;
  column?: string;
  cause?: unknown;
}

/**
 * Recursively search for a PostgreSQL error with specific code in the cause chain
 * Safely handles multiple levels of error wrapping with cycle detection
 */
function findPostgresErrorInCauseChain(
  error: unknown,
  targetCode: string,
  visited = new WeakSet<object>(),
  depth = 0
): PostgresError | null {
  // Safety limits: max depth and cycle detection
  if (depth > 10 || !error || typeof error !== 'object') {
    return null;
  }

  // Prevent infinite recursion from circular references
  if (visited.has(error as object)) {
    return null;
  }
  visited.add(error as object);

  const pgError = error as PostgresError;

  // Check if current error has the target code
  if (pgError.code === targetCode) {
    return pgError;
  }

  // Recursively check the cause chain
  if ('cause' in pgError && pgError.cause) {
    return findPostgresErrorInCauseChain(pgError.cause, targetCode, visited, depth + 1);
  }

  return null;
}

/**
 * Check if error is a direct PostgreSQL unique constraint violation
 * SQLSTATE 23505 indicates a unique constraint violation
 *
 * This function checks only the top-level error object itself
 */
export function isDirectPgUniqueViolation(error: unknown): error is PostgresError {
  if (!error || typeof error !== 'object') {
    return false;
  }
  const pgError = error as PostgresError;
  return pgError.code === '23505';
}

/**
 * Check if error is a Drizzle-wrapped PostgreSQL unique constraint violation
 * SQLSTATE 23505 indicates a unique constraint violation
 *
 * This function recursively unwraps nested causes to handle multiple wrapper layers
 * (e.g., driver → drizzle adapter → transaction wrapper)
 */
export function isDrizzleWrappedPgUniqueViolation(error: unknown): error is PostgresError {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const pgError = error as PostgresError;

  // Skip direct matches - those are handled by isDirectPgUniqueViolation
  if (pgError.code === '23505') {
    return false;
  }

  // Only check the cause chain for wrapped errors
  if ('cause' in pgError && pgError.cause) {
    return findPostgresErrorInCauseChain(pgError.cause, '23505') !== null;
  }

  return false;
}

/**
 * Check if error is a PostgreSQL unique constraint violation (direct or wrapped)
 * SQLSTATE 23505 indicates a unique constraint violation
 *
 * Combines direct error checking with recursive unwrapping for comprehensive detection
 */
export function isPgUniqueViolation(error: unknown): error is PostgresError {
  return isDirectPgUniqueViolation(error) || isDrizzleWrappedPgUniqueViolation(error);
}

/**
 * Map PostgreSQL unique constraint violations to domain errors
 * Based on the constraint name, we can determine which field caused the violation
 * Recursively unwraps nested causes to find the actual PostgreSQL error
 */
export function mapPgUniqueViolationToDomainError(error: PostgresError): Error {
  // Extract the actual PostgreSQL error by recursively searching the cause chain
  const pgError = findPostgresErrorInCauseChain(error, '23505') || error;

  const constraint = pgError.constraint?.toLowerCase() || '';
  const detail = pgError.detail?.toLowerCase() || '';
  const message = pgError.message?.toLowerCase() || '';

  // Check constraint name, error detail, or message for email/username
  if (
    constraint.includes('email') ||
    detail.includes('email') ||
    message.includes('auth_user_email_unique')
  ) {
    // Extract email from detail if possible
    const emailMatch =
      detail.match(/\(email\)=\(([^)]+)\)/) || message.match(/email["\s]*[:=]["\s]*([^,\s"]+)/);
    const email = emailMatch?.[1] || 'unknown';
    return new EmailAlreadyTakenError(email);
  }

  if (
    constraint.includes('username') ||
    detail.includes('username') ||
    message.includes('auth_user_username_unique')
  ) {
    // Extract username from detail if possible
    const usernameMatch =
      detail.match(/\(username\)=\(([^)]+)\)/) ||
      message.match(/username["\s]*[:=]["\s]*([^,\s"]+)/);
    const username = usernameMatch?.[1] || 'unknown';
    return new UsernameAlreadyTakenError(username);
  }

  // Fallback for other unique constraint violations
  return new Error(
    `Unique constraint violation: ${constraint || pgError.message || 'unknown constraint'}`
  );
}
