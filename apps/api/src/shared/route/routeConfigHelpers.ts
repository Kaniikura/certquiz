/**
 * Route configuration helper functions
 * @fileoverview Provides utility functions for creating common route configurations using RouteConfigBuilder
 */

import type { LoggerVariables } from '@api/middleware/logger';
import type { DatabaseContextVariables } from '@api/middleware/transaction';
import type { Result } from '@api/shared/result';
import type { AuthUser } from '@api/shared/types/auth-user';
import type { Context, MiddlewareHandler } from 'hono';
import { Hono } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import type { ErrorMapper, LoggingExtractors } from './RouteConfigBuilder';
import { RouteConfigBuilder } from './RouteConfigBuilder';
import type { AmbientRouteConfig } from './route-builder';
import { createAmbientRoute } from './route-builder';

/**
 * Create a standard GET route configuration
 * @security Defaults to requiresAuth: true for security. Explicitly set requiresAuth: false for public endpoints.
 *
 * @example
 * const config = createStandardGetRoute('users', {
 *   requiresAuth: false, // Explicit for public endpoints
 *   extractLogContext: (body, c) => ({ userId: c.req.param('id') }),
 *   errorMapper: mapUserError
 * });
 */
function createStandardGetRoute(
  resource: string,
  options: {
    requiresAuth?: boolean;
    extractLogContext?: (body: unknown, c?: Context) => Record<string, unknown>;
    extractSuccessLogData?: (result: unknown, c?: Context) => Record<string, unknown>;
    errorMapper: ErrorMapper;
  }
): AmbientRouteConfig {
  return new RouteConfigBuilder()
    .operation('get')
    .resource(resource)
    .requiresAuth(options.requiresAuth ?? true)
    .logging({
      extractLogContext: options.extractLogContext,
      extractSuccessLogData: options.extractSuccessLogData,
    })
    .errorMapping(options.errorMapper)
    .build();
}

/**
 * Create a standard POST route configuration
 * Supports various operations like create, submit, start, complete, login, register
 * @security Defaults to requiresAuth: true for security. Explicitly set requiresAuth: false for public endpoints.
 *
 * @example
 * const config = createStandardPostRoute('submit', 'answer', {
 *   requiresAuth: true, // Explicit for authenticated endpoints
 *   logging: {
 *     extractLogContext: (body, c) => ({ sessionId: c.req.param('sessionId') })
 *   },
 *   errorMapper: mapQuizError
 * });
 */
function createStandardPostRoute(
  operation: 'create' | 'submit' | 'start' | 'complete' | 'login' | 'register',
  resource: string,
  options: {
    requiresAuth?: boolean;
    successStatusCode?: ContentfulStatusCode;
    logging?: LoggingExtractors;
    errorMapper: ErrorMapper;
  }
): AmbientRouteConfig {
  const builder = new RouteConfigBuilder()
    .operation(operation)
    .resource(resource)
    .requiresAuth(options.requiresAuth ?? true)
    .errorMapping(options.errorMapper);

  if (options.successStatusCode) {
    builder.successStatus(options.successStatusCode);
  }

  if (options.logging) {
    builder.logging(options.logging);
  }

  return builder.build();
}

/**
 * Create a standard LIST route configuration
 * @security Defaults to requiresAuth: true for security. Explicitly set requiresAuth: false for public endpoints.
 *
 * @example
 * const config = createStandardListRoute('questions', {
 *   requiresAuth: false, // Explicit for public endpoints
 *   logging: {
 *     extractSuccessLogData: (result) => ({ count: result.items.length })
 *   },
 *   errorMapper: mapQuestionError
 * });
 */
function createStandardListRoute(
  resource: string,
  options: {
    requiresAuth?: boolean;
    logging?: LoggingExtractors;
    errorMapper: ErrorMapper;
  }
): AmbientRouteConfig {
  return new RouteConfigBuilder()
    .operation('list')
    .resource(resource)
    .requiresAuth(options.requiresAuth ?? true)
    .logging(options.logging || {})
    .errorMapping(options.errorMapper)
    .build();
}

/**
 * Route definition for creating standardized routes
 */
interface RouteDefinition<TReq, TRes, TDeps> {
  /** HTTP method */
  method: 'get' | 'post' | 'put' | 'delete';
  /** Route path */
  path: string;
  /** Optional validator middleware */
  validator?: MiddlewareHandler; // Hono middleware handler type
  /** Route configuration options */
  configOptions: {
    operation?: 'get' | 'create' | 'submit' | 'start' | 'complete' | 'list' | 'login' | 'register';
    resource: string;
    requiresAuth?: boolean;
    successStatusCode?: ContentfulStatusCode;
    logging?: LoggingExtractors;
    errorMapper: ErrorMapper;
  };
  /** Route handler function */
  handler: (
    body: TReq,
    deps: TDeps,
    context: Context<{ Variables: { user: AuthUser } & LoggerVariables & DatabaseContextVariables }>
  ) => Promise<Result<TRes, Error>>;
  /** Function to map context to dependencies */
  getDependencies: (c: Context) => TDeps;
}

/**
 * Build route configuration based on operation type and options
 * Extracted from IIFE for improved readability and testability
 */
function buildRouteConfig<TReq, TRes, TDeps>(
  configOptions: RouteDefinition<TReq, TRes, TDeps>['configOptions']
): AmbientRouteConfig {
  const { operation, resource, requiresAuth, successStatusCode, logging, errorMapper } =
    configOptions;

  // Use existing helpers based on operation type
  if (operation === 'get') {
    return createStandardGetRoute(resource, {
      requiresAuth,
      extractLogContext: logging?.extractLogContext,
      extractSuccessLogData: logging?.extractSuccessLogData,
      errorMapper,
    });
  } else if (
    operation === 'create' ||
    operation === 'submit' ||
    operation === 'start' ||
    operation === 'complete' ||
    operation === 'login' ||
    operation === 'register'
  ) {
    return createStandardPostRoute(operation, resource, {
      requiresAuth,
      successStatusCode,
      logging,
      errorMapper,
    });
  } else if (operation === 'list') {
    return createStandardListRoute(resource, {
      requiresAuth,
      logging,
      errorMapper,
    });
  }

  // Fallback to manual builder
  const builder = new RouteConfigBuilder()
    .resource(resource)
    .requiresAuth(requiresAuth ?? true)
    .errorMapping(errorMapper);

  if (operation) {
    builder.operation(operation);
  }
  if (successStatusCode) {
    builder.successStatus(successStatusCode);
  }
  if (logging) {
    builder.logging(logging);
  }

  return builder.build();
}

/**
 * Create a standardized route with minimal boilerplate
 * Encapsulates common patterns for route creation
 *
 * @example
 * export const submitAnswerRoute = createStandardRoute({
 *   method: 'post',
 *   path: '/:sessionId/submit-answer',
 *   validator: zValidator('json', submitAnswerSchema),
 *   configOptions: {
 *     operation: 'submit',
 *     resource: 'answer',
 *     requiresAuth: true,
 *     logging: { ... },
 *     errorMapper: mapSubmitAnswerError,
 *   },
 *   handler: submitAnswerHandler,
 *   getDependencies: (c) => ({ ... }),
 * });
 */
export function createStandardRoute<TReq = unknown, TRes = unknown, TDeps = unknown>(
  definition: RouteDefinition<TReq, TRes, TDeps>
): Hono<{ Variables: { user: AuthUser } & LoggerVariables & DatabaseContextVariables }> {
  const hono = new Hono<{
    Variables: { user: AuthUser } & LoggerVariables & DatabaseContextVariables;
  }>();

  // Build route configuration
  const config = buildRouteConfig(definition.configOptions);

  // Create the ambient route
  const route = createAmbientRoute<
    TReq,
    TRes,
    TDeps,
    { user: AuthUser } & LoggerVariables & DatabaseContextVariables
  >(config, definition.handler);

  // Register the route with Hono
  const routeHandler = (c: Context) => {
    const deps = definition.getDependencies(c);
    return route(c, deps);
  };

  // Helper function to register route with optional validator
  const registerRoute = (method: string, validator?: MiddlewareHandler): void => {
    const handlers = validator ? [validator, routeHandler] : [routeHandler];
    switch (method) {
      case 'get':
        hono.get(definition.path, ...handlers);
        break;
      case 'post':
        hono.post(definition.path, ...handlers);
        break;
      case 'put':
        hono.put(definition.path, ...handlers);
        break;
      case 'delete':
        hono.delete(definition.path, ...handlers);
        break;
    }
  };

  // Register route with optional validator
  registerRoute(definition.method, definition.validator);

  return hono;
}
