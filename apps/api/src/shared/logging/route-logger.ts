/**
 * Route Logging Utilities
 *
 * Provides consistent logging patterns for route handlers
 * to reduce duplication and ensure uniform log structure.
 */

import type { AuthUser } from '@api/middleware/auth/auth-user';
import { createErrorLogObject } from '@api/shared/error';
import type { LoggerPort } from '@api/shared/logger';

/**
 * Common route operation types for logging
 */
export type RouteOperation =
  | 'list'
  | 'get'
  | 'create'
  | 'update'
  | 'delete'
  | 'login'
  | 'register'
  | 'submit'
  | 'start'
  | 'complete';

/**
 * Base context for route logging
 */
interface RouteLogContext {
  operation: RouteOperation;
  resource: string;
  user?: AuthUser;
  [key: string]: unknown;
}

/**
 * Log an operation attempt
 *
 * @param logger - Logger instance
 * @param context - Route context and additional data
 */
function _logAttempt(logger: LoggerPort, context: RouteLogContext): void {
  const { operation, resource, user, ...additionalData } = context;
  const message = `${capitalizeFirst(operation)} ${resource} attempt`;

  logger.info(message, {
    userId: user?.sub,
    userRoles: user?.roles,
    isAuthenticated: !!user,
    ...additionalData,
  });
}

/**
 * Log a successful operation
 *
 * @param logger - Logger instance
 * @param context - Route context and result data
 */
function _logSuccess(
  logger: LoggerPort,
  context: RouteLogContext & { result?: Record<string, unknown> }
): void {
  const { operation, resource, user, result, ...additionalData } = context;
  const message = `${capitalizeFirst(operation)} ${resource} successful`;

  logger.info(message, {
    userId: user?.sub,
    userRoles: user?.roles,
    ...result,
    ...additionalData,
  });
}

/**
 * Log a failed operation
 *
 * @param logger - Logger instance
 * @param context - Route context and error details
 */
function _logFailure(logger: LoggerPort, context: RouteLogContext & { error: unknown }): void {
  const { operation, resource, user, error, ...additionalData } = context;
  const message = `${capitalizeFirst(operation)} ${resource} failed`;

  logger.warn(message, {
    userId: user?.sub,
    userRoles: user?.roles,
    ...createErrorLogObject(error),
    ...additionalData,
  });
}

/**
 * Log a route error (unexpected errors)
 *
 * @param logger - Logger instance
 * @param context - Route context and error
 */
function _logRouteError(
  logger: LoggerPort,
  context: { operation: RouteOperation; resource: string; error: unknown }
): void {
  const message = `${capitalizeFirst(context.operation)} ${context.resource} route error`;
  logger.error(message, createErrorLogObject(context.error));
}

/**
 * Create a route logger with pre-configured context
 *
 * @param logger - Base logger instance
 * @param operation - Operation type
 * @param resource - Resource name
 * @returns Configured route logger functions
 */
export function createRouteLogger(logger: LoggerPort, operation: RouteOperation, resource: string) {
  return {
    attempt: (user?: AuthUser, additionalData?: Record<string, unknown>) =>
      _logAttempt(logger, { operation, resource, user, ...additionalData }),

    success: (
      user?: AuthUser,
      result?: Record<string, unknown>,
      additionalData?: Record<string, unknown>
    ) => _logSuccess(logger, { operation, resource, user, result, ...additionalData }),

    failure: (error: unknown, user?: AuthUser, additionalData?: Record<string, unknown>) =>
      _logFailure(logger, { operation, resource, error, user, ...additionalData }),

    error: (error: unknown) => _logRouteError(logger, { operation, resource, error }),
  };
}

/**
 * Capitalize first letter of a string
 */
function capitalizeFirst(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}
