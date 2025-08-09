import type { IDatabaseContext } from '@api/infra/db/IDatabaseContext';
import type { Context, Next } from 'hono';
import type { LoggerVariables } from './logger';

export interface DatabaseContextVariables {
  dbContext: IDatabaseContext;
}

/**
 * Creates database context middleware for unified database access pattern.
 * This middleware provides direct access to DatabaseContext, replacing the two-tier
 * UnitOfWork pattern with a more intuitive single-tier approach.
 */
export function createDatabaseContextMiddleware(dbContext: IDatabaseContext) {
  return async (
    c: Context<{ Variables: LoggerVariables & DatabaseContextVariables }>,
    next: Next
  ) => {
    const logger = c.get('logger');

    // Store DatabaseContext in request context
    c.set('dbContext', dbContext);

    try {
      logger.debug('Database context available');
      await next();
      logger.debug('Request completed');
    } catch (error) {
      logger.error({ error }, 'Request failed');
      throw error;
    }
  };
}
