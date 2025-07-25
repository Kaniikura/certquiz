import type { IUnitOfWork } from '@api/infra/db/IUnitOfWork';
import type { IUnitOfWorkProvider } from '@api/infra/db/IUnitOfWorkProvider';
import type { Context, Next } from 'hono';
import type { LoggerVariables } from './logger';

export interface TransactionVariables {
  uow: IUnitOfWork;
}

/**
 * Creates transaction middleware for Ambient UoW pattern.
 * This middleware manages the transaction lifecycle and stores the UoW in the request context.
 */
export function createTransactionMiddleware(provider: IUnitOfWorkProvider) {
  return async (c: Context<{ Variables: LoggerVariables & TransactionVariables }>, next: Next) => {
    const logger = c.get('logger');

    // Execute within transaction scope
    await provider.execute(async (uow) => {
      // Store UoW in request context
      c.set('uow', uow);

      try {
        logger.debug('Transaction started');
        await next();
        logger.debug('Transaction committed');
      } catch (error) {
        logger.error('Transaction rolled back', { error });
        throw error;
      }
    });
  };
}
