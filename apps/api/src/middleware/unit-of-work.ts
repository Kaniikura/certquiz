/**
 * Unit of Work Provider Middleware
 *
 * Injects the Unit of Work provider into the Hono context,
 * allowing handlers to access it without environment-based switching.
 */

import type { IUnitOfWorkProvider } from '@api/infra/db/IUnitOfWorkProvider';
import { createMiddleware } from 'hono/factory';

/**
 * Type for Unit of Work provider variables in context
 */
export type UnitOfWorkVariables = {
  uowProvider: IUnitOfWorkProvider;
};

/**
 * Creates middleware that injects a Unit of Work provider into the request context
 *
 * @deprecated Consider using `createTransactionMiddleware` from `@api/middleware/transaction`
 * for the Ambient UoW pattern, which manages transaction lifecycle automatically.
 *
 * This middleware enables dependency injection of the Unit of Work provider,
 * allowing different implementations (production vs test) to be injected
 * at application startup rather than determined by environment variables.
 *
 * @param provider - The Unit of Work provider instance to inject
 * @returns Middleware that adds the provider to the request context
 *
 * @example
 * ```typescript
 * // Deprecated pattern
 * const provider = new InMemoryUnitOfWorkProvider();
 * app.use('*', createUnitOfWorkMiddleware(provider));
 *
 * // In handlers
 * const provider = c.get('uowProvider');
 * const result = await provider.execute(async (uow) => {
 *   // Use unit of work
 * });
 *
 * // Preferred: Use transaction middleware (Ambient UoW pattern)
 * import { createTransactionMiddleware } from '@api/middleware/transaction';
 * const provider = new InMemoryUnitOfWorkProvider();
 * app.use('*', createTransactionMiddleware(provider));
 *
 * // In handlers - UoW is automatically available
 * const uow = c.get('uow');
 * // Use unit of work directly, transaction lifecycle is managed automatically
 * ```
 */
export function createUnitOfWorkMiddleware(provider: IUnitOfWorkProvider) {
  return createMiddleware<{ Variables: UnitOfWorkVariables }>(async (c, next) => {
    // Inject the provider into the context
    c.set('uowProvider', provider);

    // Continue with the request
    await next();
  });
}
