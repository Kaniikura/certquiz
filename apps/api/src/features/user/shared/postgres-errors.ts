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
 * Check if error is a PostgreSQL unique constraint violation
 * SQLSTATE 23505 indicates a unique constraint violation
 *
 * Drizzle ORM wraps PostgreSQL errors, so we need to check both:
 * 1. Direct PostgreSQL error with code property
 * 2. Drizzle error with cause property containing the PostgreSQL error
 */
export function isPgUniqueViolation(error: unknown): error is PostgresError {
  if (!error || typeof error !== 'object') return false;

  // Check if it's a direct PostgreSQL error
  const pgError = error as PostgresError;
  if (pgError.code === '23505') {
    return true;
  }

  // Check if it's a Drizzle error wrapping a PostgreSQL error
  // Drizzle errors have a 'cause' property with the original error
  if ('cause' in pgError && pgError.cause && typeof pgError.cause === 'object') {
    const cause = pgError.cause as PostgresError;
    return cause.code === '23505';
  }

  return false;
}

/**
 * Map PostgreSQL unique constraint violations to domain errors
 * Based on the constraint name, we can determine which field caused the violation
 */
export function mapPgUniqueViolationToDomainError(error: PostgresError): Error {
  // Extract the actual PostgreSQL error if it's wrapped
  let pgError = error;
  if ('cause' in error && error.cause && typeof error.cause === 'object') {
    pgError = error.cause as PostgresError;
  }

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
