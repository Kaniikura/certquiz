/**
 * Route configuration builder with fluent interface
 * @fileoverview Provides a type-safe builder pattern for creating AmbientRouteConfig objects
 */

import type { RouteOperation } from '@api/shared/logging/route-logger';
import type { Context } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import type { AmbientRouteConfig } from './route-builder';

/**
 * Logging extractors for route configuration
 */
export interface LoggingExtractors {
  /** Extract log context from request body */
  extractLogContext?: (body: unknown, c?: Context) => Record<string, unknown>;
  /** Extract success log data from result */
  extractSuccessLogData?: (result: unknown, c?: Context) => Record<string, unknown>;
}

/**
 * Error mapper function type
 */
export type ErrorMapper = (error: Error) => { status: ContentfulStatusCode; body: Response };

/**
 * Fluent builder for creating route configurations
 *
 * @example
 * const config = new RouteConfigBuilder()
 *   .operation('get')
 *   .resource('users')
 *   .requiresAuth()
 *   .logging({
 *     extractLogContext: (body, c) => ({ userId: c.req.param('id') })
 *   })
 *   .errorMapping(mapUserError)
 *   .build();
 */
export class RouteConfigBuilder {
  private config: Partial<AmbientRouteConfig> = {};

  /**
   * Set the route operation type
   */
  operation(op: RouteOperation): this {
    this.config.operation = op;
    return this;
  }

  /**
   * Set the resource name
   */
  resource(res: string): this {
    this.config.resource = res;
    return this;
  }

  /**
   * Set authentication requirement
   * @param auth - Whether authentication is required (defaults to true)
   */
  requiresAuth(auth = true): this {
    this.config.requiresAuth = auth;
    return this;
  }

  /**
   * Set the success status code
   */
  successStatus(status: ContentfulStatusCode): this {
    this.config.successStatusCode = status;
    return this;
  }

  /**
   * Configure logging extractors
   */
  logging(extractors: LoggingExtractors): this {
    if (extractors.extractLogContext) {
      this.config.extractLogContext = extractors.extractLogContext;
    }
    if (extractors.extractSuccessLogData) {
      this.config.extractSuccessLogData = extractors.extractSuccessLogData;
    }
    return this;
  }

  /**
   * Set the error mapper function
   */
  errorMapping(mapper: ErrorMapper): this {
    this.config.errorMapper = mapper;
    return this;
  }

  /**
   * Build the final configuration object
   * @throws Error if required fields are missing
   */
  build(): AmbientRouteConfig {
    if (!this.config.operation) {
      throw new Error('RouteConfigBuilder: operation is required');
    }
    if (!this.config.resource) {
      throw new Error('RouteConfigBuilder: resource is required');
    }
    if (!this.config.errorMapper) {
      throw new Error('RouteConfigBuilder: errorMapper is required');
    }

    return this.config as AmbientRouteConfig;
  }
}
