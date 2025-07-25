/**
 * Error Sanitization and Handling Utilities
 *
 * Provides consistent error handling and sanitization across the application
 * to prevent sensitive information leakage and ensure consistent error formats.
 */

/**
 * Sanitized error structure for logging
 */
interface SanitizedError {
  message: string;
  type: string;
  stack?: string;
  code?: string;
  constraint?: string;
  severity?: string;
  [key: string]: unknown;
}

/**
 * Configuration for error sanitization
 */
interface SanitizeErrorConfig {
  /** Default message when error is unknown */
  defaultMessage: string;
  /** Whether to include stack traces */
  includeStack: boolean;
  /** List of safe properties to extract from error object */
  safeProperties: string[];
}

/**
 * Helper to safely extract string properties from an object
 */
function extractStringProperty(obj: unknown, key: string): string | undefined {
  if (obj && typeof obj === 'object' && key in obj) {
    const value = (obj as Record<string, unknown>)[key];
    return typeof value === 'string' ? value : undefined;
  }
  return undefined;
}

/**
 * Base sanitized error structure used internally
 */
type BaseSanitizedError = {
  message: string;
  type: string;
  [key: string]: unknown;
};

/**
 * Core error sanitization logic
 * Extracts safe information from various error types
 *
 * @param error - The error to sanitize
 * @param config - Configuration for sanitization
 * @returns Sanitized error object
 */
function sanitizeError(error: unknown, config: SanitizeErrorConfig): BaseSanitizedError {
  const safeError: BaseSanitizedError = {
    message: config.defaultMessage,
    type: 'unknown',
  };

  if (error instanceof Error) {
    safeError.message = error.message;
    safeError.type = error.constructor.name;

    if (config.includeStack && error.stack) {
      safeError.stack = error.stack;
    }

    // Extract additional safe properties
    for (const prop of config.safeProperties) {
      const value = extractStringProperty(error, prop);
      if (value) safeError[prop] = value;
    }
  } else if (typeof error === 'string') {
    safeError.message = error;
    safeError.type = 'string';
  } else if (error && typeof error === 'object') {
    const message = extractStringProperty(error, 'message');
    if (message) safeError.message = message;
    safeError.type = 'object';
  }

  return safeError;
}

/**
 * Sanitize error objects for logging purposes
 * Includes stack traces and additional debug information
 *
 * @param error - The error to sanitize
 * @returns Sanitized error object safe for logging
 */
export function sanitizeErrorForLogging(error: unknown): SanitizedError {
  const result = sanitizeError(error, {
    defaultMessage: 'Unknown error',
    includeStack: true,
    safeProperties: ['code', 'constraint', 'severity'],
  });
  return result as SanitizedError;
}

/**
 * Extract error message safely
 * Convenience function for simple error message extraction
 *
 * @param error - The error to extract message from
 * @returns Error message string
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  if (error && typeof error === 'object') {
    const message = extractStringProperty(error, 'message');
    if (message) return message;
  }
  return 'Unknown error';
}

/**
 * Create a logging object from an error
 * Convenience function for consistent error logging
 *
 * @param error - The error to log
 * @param additionalContext - Additional context to include in the log
 * @returns Object suitable for structured logging
 */
export function createErrorLogObject(
  error: unknown,
  additionalContext?: Record<string, unknown>
): Record<string, unknown> {
  const sanitized = sanitizeErrorForLogging(error);
  return {
    ...additionalContext,
    error: sanitized.message,
    errorType: sanitized.type,
    stack: sanitized.stack,
    ...(sanitized.code && { errorCode: sanitized.code }),
  };
}
