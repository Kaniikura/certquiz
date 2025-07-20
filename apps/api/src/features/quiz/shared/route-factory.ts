/**
 * Route factory for quiz feature
 * @fileoverview Generic route creation utility to reduce duplication
 */

import { createDomainLogger } from '@api/infra/logger/PinoLoggerAdapter';
import type { AuthUser } from '@api/middleware/auth/auth-user';
import type { Result } from '@api/shared/result';
import { type Context, Hono, type MiddlewareHandler } from 'hono';
import { createSuccessResponse, handleRouteError } from './route-utils';
import { executeInTransaction, type TransactionHandler } from './transaction-executor';

/**
 * Route handler that returns a Result type
 */
export type RouteHandler<TRequest, TResponse> = (
  request: TRequest,
  context: RouteHandlerContext
) => Promise<Result<TResponse>>;

/**
 * Context provided to route handlers
 */
export interface RouteHandlerContext {
  /** Authenticated user */
  user: AuthUser;
  /** URL parameters */
  params: Record<string, string>;
  /** Additional services */
  services: Record<string, unknown>;
}

/**
 * Configuration for creating a route
 */
export interface RouteConfig<TRequest, TResponse> {
  /** HTTP method */
  method: 'get' | 'post' | 'put' | 'delete';
  /** Route path */
  path: string;
  /** Logger name for domain logging */
  loggerName: string;
  /** Optional request validator middleware */
  validator?: MiddlewareHandler;
  /** Route handler function (not needed if createTransactionHandler is provided) */
  handler?: RouteHandler<TRequest, TResponse>;
  /** Services to inject */
  services?: Record<string, unknown>;
  /** Extract context data for logging */
  getLogContext?: (request: TRequest, params: Record<string, string>) => Record<string, unknown>;
  /** Extract success log data */
  getSuccessLogData?: (response: TResponse) => Record<string, unknown>;
  /** Optional transaction handler creator */
  createTransactionHandler?: (
    request: TRequest,
    context: RouteHandlerContext
  ) => TransactionHandler<Result<TResponse>>;
}

/**
 * Extract request from context based on method and validator
 */
function extractRequest<TRequest>(
  c: Context,
  method: string,
  hasValidator: boolean
): TRequest | Promise<TRequest> {
  if (method === 'get') {
    return {} as TRequest;
  } else if (hasValidator) {
    return (c as Context & { req: { valid: (target: string) => unknown } }).req.valid(
      'json'
    ) as TRequest;
  } else {
    return c.req.json<TRequest>();
  }
}

/**
 * Execute handler with or without transaction
 */
async function executeHandler<TRequest, TResponse>(
  config: RouteConfig<TRequest, TResponse>,
  request: TRequest,
  context: RouteHandlerContext,
  logger: ReturnType<typeof createDomainLogger>
): Promise<Result<TResponse>> {
  if (config.createTransactionHandler) {
    const transactionHandler = config.createTransactionHandler(request, context);
    return executeInTransaction(transactionHandler, {
      userSub: context.user.sub,
      sessionIdParam: context.params.sessionId,
      logger,
    });
  } else if (config.handler) {
    return config.handler(request, context);
  } else {
    throw new Error('Either handler or createTransactionHandler must be provided');
  }
}

/**
 * Creates a Hono route with common patterns
 * Handles logging, error handling, and response formatting
 */
export function createQuizRoute<TRequest = unknown, TResponse = unknown>(
  config: RouteConfig<TRequest, TResponse>
): Hono<{ Variables: { user: AuthUser } }> {
  const route = new Hono<{ Variables: { user: AuthUser } }>();
  const logger = createDomainLogger(config.loggerName);

  // Build middleware array
  const middlewares: MiddlewareHandler[] = [];
  if (config.validator) {
    middlewares.push(config.validator);
  }

  // Create the route handler
  const routeHandler = async (c: Context<{ Variables: { user: AuthUser } }>) => {
    const user = c.get('user');
    const params = c.req.param();
    const request = await extractRequest<TRequest>(c, config.method, !!config.validator);

    const logContext = config.getLogContext
      ? config.getLogContext(request, params)
      : { userId: user.sub, ...params };

    try {
      logger.info(`${config.method.toUpperCase()} ${config.path}`, logContext);

      const context: RouteHandlerContext = {
        user,
        params,
        services: config.services || {},
      };

      const result = await executeHandler(config, request, context, logger);

      if (!result.success) {
        return handleRouteError(c, result.error, logger, logContext);
      }

      const response = result.data;
      const successLogData = config.getSuccessLogData ? config.getSuccessLogData(response) : {};

      logger.info('Request completed successfully', {
        ...logContext,
        ...successLogData,
      });

      return c.json(createSuccessResponse(response));
    } catch (error) {
      logger.error('Route handler error', {
        ...logContext,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      return c.json({ error: 'Internal server error' }, 500);
    }
  };

  // Register the route with middlewares
  if (middlewares.length > 0) {
    route[config.method](config.path, ...middlewares, routeHandler);
  } else {
    route[config.method](config.path, routeHandler);
  }

  return route;
}
