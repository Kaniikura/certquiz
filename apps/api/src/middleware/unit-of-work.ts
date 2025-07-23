/**
 * Unit of Work Middleware
 * @fileoverview Provides IUnitOfWork instances to route handlers via context
 *
 * This middleware manages the creation and lifecycle of Unit of Work instances,
 * allowing routes to access repositories through a consistent transaction context.
 */

import type { IUnitOfWork } from '@api/infra/db/IUnitOfWork';
import type { Logger } from '@api/infra/logger';
import type { MiddlewareHandler } from 'hono';
import type { LoggerVariables } from './logger';

/**
 * Context variables provided by this middleware
 */
export interface UnitOfWorkVariables {
  /**
   * Unit of Work instance for the current request
   * Provides access to all repositories within a transaction context
   */
  unitOfWork: IUnitOfWork;
}

/**
 * Factory function type for creating Unit of Work instances
 * Can return either real or fake implementations based on environment
 */
export type UnitOfWorkFactory = (logger: Logger) => Promise<IUnitOfWork>;

/**
 * Creates Unit of Work provider middleware
 *
 * This middleware:
 * 1. Creates a new Unit of Work instance for each request
 * 2. Provides it to the context for route handlers
 * 3. Manages the transaction lifecycle (begin/commit/rollback)
 * 4. Handles errors by rolling back transactions
 *
 * @param factory - Factory function to create UoW instances
 * @returns Hono middleware handler
 *
 * @example
 * ```typescript
 * // In app setup
 * const uowMiddleware = createUnitOfWorkMiddleware(createUnitOfWork);
 * app.use('/api/*', uowMiddleware);
 *
 * // In route handler
 * app.get('/users/:id', async (c) => {
 *   const uow = c.get('unitOfWork');
 *   const userRepo = uow.getUserRepository();
 *   const user = await userRepo.findById(c.req.param('id'));
 *   return c.json(user);
 * });
 * ```
 */
export function createUnitOfWorkMiddleware(factory: UnitOfWorkFactory): MiddlewareHandler<{
  Variables: LoggerVariables & UnitOfWorkVariables;
}> {
  return async (c, next) => {
    const logger = c.get('logger');

    // Create a new Unit of Work instance for this request
    const unitOfWork = await factory(logger);

    // Begin transaction
    await unitOfWork.begin();

    // Track if an error occurred
    let errorOccurred = false;

    try {
      // Provide UoW to context
      c.set('unitOfWork', unitOfWork);

      // Execute route handler
      await next();

      // Check if response indicates an error (4xx or 5xx status)
      // This is needed because Hono might handle errors without throwing
      if (c.res && c.res.status >= 400) {
        errorOccurred = true;
      }
    } catch (error) {
      errorOccurred = true;
      // Re-throw error for error handler middleware
      throw error;
    } finally {
      // Always commit or rollback based on whether an error occurred
      if (errorOccurred) {
        try {
          await unitOfWork.rollback();
        } catch (rollbackError) {
          // Log rollback errors but don't throw them
          // We're already handling another error
          logger.error('Error during transaction rollback', {
            error: rollbackError,
            originalError: true,
          });
        }
      } else {
        // If no error occurred, try to commit
        // Commit errors should be thrown as they indicate a problem
        await unitOfWork.commit();
      }
    }
  };
}

/**
 * Creates a selective Unit of Work middleware that only applies to certain paths
 *
 * This is useful when some routes don't need database access or should use
 * different transaction strategies.
 *
 * @param factory - Factory function to create UoW instances
 * @param excludedPaths - Set of paths to exclude from UoW middleware
 * @returns Hono middleware handler
 */
export function createSelectiveUnitOfWorkMiddleware(
  factory: UnitOfWorkFactory,
  excludedPaths: Set<string>
): MiddlewareHandler<{
  Variables: LoggerVariables & UnitOfWorkVariables;
}> {
  return async (c, next) => {
    const requestPath = c.req.path;

    // Skip UoW for excluded paths
    if (excludedPaths.has(requestPath)) {
      return next();
    }

    // Apply UoW middleware for other paths
    return createUnitOfWorkMiddleware(factory)(c, next);
  };
}
