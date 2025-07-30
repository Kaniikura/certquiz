import type { TransactionVariables } from '@api/middleware/transaction';
import type { RepositoryToken } from '@api/shared/types/RepositoryToken';
import type { Context } from 'hono';

/**
 * Repository provider functions that extract repositories from ambient UoW.
 * These functions provide type-safe access to repositories within a transaction context.
 */

/**
 * Gets a repository from the ambient transaction context using a type-safe token.
 * This is the preferred method for accessing repositories as it provides compile-time type safety.
 *
 * @param c - Hono context with transaction variables
 * @param token - Type-safe repository token
 * @returns Repository instance of the correct type
 * @throws {Error} If no active transaction is found
 *
 * @example
 * ```typescript
 * const userRepo = getRepository(c, USER_REPO_TOKEN);
 * // userRepo is correctly typed as IUserRepository
 * ```
 */
export function getRepository<T, V extends TransactionVariables = TransactionVariables>(
  c: Context<{ Variables: V }>,
  token: RepositoryToken<T>
): T {
  const uow = c.get('uow');
  if (!uow) {
    throw new Error('No active transaction. Ensure `createTransactionMiddleware` is applied.');
  }
  return uow.getRepository(token);
}
