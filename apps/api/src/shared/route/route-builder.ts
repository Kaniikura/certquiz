/**
 * Ambient Route Builder Utilities
 *
 * Provides route builders for the Ambient Unit of Work pattern where
 * transaction management is handled by middleware and handlers receive
 * only the repositories they need.
 */

import type { AuthUser } from '@api/middleware/auth/auth-user';
import type { LoggerVariables } from '@api/middleware/logger';
import type { LoggerPort } from '@api/shared/logger/LoggerPort';
import type { RouteOperation } from '@api/shared/logging';
import { createRouteLogger } from '@api/shared/logging';
import type { Result } from '@api/shared/result';
import type { Context } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';

/**
 * Standard API response format
 */
interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
}

/**
 * Safely parse JSON from request body
 */
async function safeParseJson(c: Context): Promise<unknown> {
  try {
    return await c.req.json();
  } catch {
    return null;
  }
}

/**
 * Helper function to handle authentication check
 */
function checkAuthentication<TVariables extends LoggerVariables>(
  c: Context<{ Variables: TVariables }>,
  requiresAuth: boolean
): ApiResponse | null {
  if (!requiresAuth) return null;

  const user = c.get('user' as keyof TVariables) as AuthUser | undefined;
  if (!user) {
    return {
      success: false,
      error: {
        code: 'AUTHENTICATION_REQUIRED',
        message: 'Authentication required',
      },
    };
  }
  return null;
}

/**
 * Helper function to handle route errors
 */
function handleRouteError(
  error: Error,
  errorMapper: (error: Error) => { status: ContentfulStatusCode; body: Response }
): { status: ContentfulStatusCode; body: Response } {
  const err = error instanceof Error ? error : new Error('Unknown error');
  return errorMapper(err);
}

/**
 * Route configuration for ambient routes
 */
interface AmbientRouteConfig {
  /** Route operation type for logging */
  operation: RouteOperation;
  /** Resource name for logging */
  resource: string;
  /** Whether this route requires authentication */
  requiresAuth?: boolean;
  /** HTTP status code for successful responses (defaults to 200) */
  successStatusCode?: ContentfulStatusCode;
  /** Extract log context from request body */
  extractLogContext?: (body: unknown, c?: Context) => Record<string, unknown>;
  /** Extract success log data from result */
  extractSuccessLogData?: (result: unknown, c?: Context) => Record<string, unknown>;
  /** Map domain errors to HTTP responses */
  errorMapper: (error: Error) => { status: ContentfulStatusCode; body: Response };
}

/**
 * Creates a route handler that expects repositories to be injected.
 * Transaction management is handled by middleware.
 *
 * @param config - Route configuration
 * @param handler - Route handler that receives body, dependencies, and context
 * @returns Hono route handler
 */
export function createAmbientRoute<
  TBody = unknown,
  TResult = unknown,
  TDeps = unknown,
  TVariables extends LoggerVariables = LoggerVariables,
>(
  config: AmbientRouteConfig,
  handler: (
    body: TBody,
    deps: TDeps,
    c: Context<{ Variables: TVariables }>
  ) => Promise<Result<TResult, Error>>
) {
  return async (c: Context<{ Variables: TVariables }>, deps: TDeps): Promise<Response> => {
    const logger = c.get('logger') as LoggerPort;
    const routeLogger = createRouteLogger(logger, config.operation, config.resource);

    try {
      // Check authentication
      const authError = checkAuthentication(
        c as Context<{ Variables: TVariables }>,
        config.requiresAuth || false
      );
      if (authError) {
        return c.json(authError, 401);
      }

      // Parse request body
      const body = await safeParseJson(c);
      const user = c.get('user');
      const logContext = config.extractLogContext ? config.extractLogContext(body, c) : {};

      // Log attempt
      routeLogger.attempt(user, logContext);

      // Execute handler with injected dependencies
      const result = await handler(body as TBody, deps, c as Context<{ Variables: TVariables }>);

      if (!result.success) {
        routeLogger.failure(result.error, user, logContext);
        const { body: errorBody } = config.errorMapper(result.error);
        // errorBody is already a Response object with the correct status
        return errorBody;
      }

      // Log success
      const successLogData = config.extractSuccessLogData
        ? config.extractSuccessLogData(result.data, c)
        : {};
      routeLogger.success(user, successLogData, logContext);

      return c.json(
        { success: true, data: result.data },
        (config.successStatusCode || 200) as ContentfulStatusCode
      );
    } catch (error) {
      routeLogger.error(error);
      const { body: errorBody } = handleRouteError(
        error instanceof Error ? error : new Error('Unknown error'),
        config.errorMapper
      );
      // errorBody is already a Response object with the correct status
      return errorBody;
    }
  };
}
