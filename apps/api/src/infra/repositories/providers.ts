import type { DatabaseContextVariables } from '@api/middleware/transaction';
import type { RepositoryToken } from '@api/shared/types/RepositoryToken';
import type { Context } from 'hono';

/**
 * Repository provider functions that extract repositories from database contexts.
 * These functions provide type-safe access to repositories within different contexts.
 */

/**
 * Gets a repository from the ambient database context using a type-safe token.
 * This is the preferred method for accessing repositories as it provides compile-time type safety
 * and supports both transactional and non-transactional operations.
 *
 * @param c - Hono context with database context variables
 * @param token - Type-safe repository token
 * @returns Repository instance of the correct type
 * @throws {Error} If no database context is found
 *
 * @example
 * ```typescript
 * const userRepo = getRepositoryFromContext(c, USER_REPO_TOKEN);
 * // userRepo is correctly typed as IUserRepository
 * ```
 */
export function getRepositoryFromContext<
  T,
  V extends DatabaseContextVariables = DatabaseContextVariables,
>(c: Context<{ Variables: V }>, token: RepositoryToken<T>): T {
  const dbContext = c.get('dbContext');
  if (!dbContext) {
    throw new Error(
      'No database context available. Ensure `createDatabaseContextMiddleware` is applied.'
    );
  }
  return dbContext.getRepository(token);
}
