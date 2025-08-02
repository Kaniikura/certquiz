/**
 * Test helpers for Ambient Unit of Work pattern
 *
 * @deprecated The following functions are deprecated and will be removed in a future release:
 * - `createTestDatabaseContext`: Use `createDatabaseContextMiddleware` with `InMemoryDatabaseContext` instead.
 * - `getTestDatabaseContext`: Use the `DatabaseContext` API directly to access repositories.
 *
 * Migration path:
 * - Replace calls to `createTestDatabaseContext` with `createDatabaseContextMiddleware` and configure it with `InMemoryDatabaseContext`.
 * - Replace calls to `getTestDatabaseContext` with direct usage of the `DatabaseContext` API.
 */

import type { IAuthUserRepository } from '@api/features/auth/domain';
import type { IQuestionRepository } from '@api/features/question/domain';
import type { IQuizRepository } from '@api/features/quiz/domain';
import type { IUserRepository } from '@api/features/user/domain';
import type { IDatabaseContext } from '@api/infra/db/IDatabaseContext';
import type { DatabaseContextVariables } from '@api/middleware/transaction';
import { InMemoryDatabaseContext } from '@api/testing/domain/fakes';
import type { Context } from 'hono';

/**
 * Repository set for creating test contexts
 */
export interface RepositorySet {
  authUser?: IAuthUserRepository;
  user?: IUserRepository;
  quiz?: IQuizRepository;
  question?: IQuestionRepository;
}

/**
 * Helper to create dependencies for ambient route handlers
 */
export interface TestDependencies<T> {
  create(): T;
}

/**
 * Creates a test context with DatabaseContext (preferred approach)
 * This provides a more intuitive API for testing database operations
 *
 * @returns Context with DatabaseContext set in variables
 *
 * @example
 * ```typescript
 * const context = createTestDatabaseContext();
 * const dbContext = context.get('dbContext');
 *
 * await dbContext.withinTransaction(async (ctx) => {
 *   const userRepo = ctx.getRepository(USER_REPO_TOKEN);
 *   const user = User.create({...});
 *   await userRepo.save(user);
 * });
 * ```
 */
export function createTestDatabaseContext(): Context<{ Variables: DatabaseContextVariables }> {
  const dbContext = new InMemoryDatabaseContext();

  const contextMap = new Map<string, unknown>();
  contextMap.set('dbContext', dbContext);

  // Create a minimal Context implementation for testing
  const context = {
    get: (key: string) => contextMap.get(key),
    set: (key: string, value: unknown) => contextMap.set(key, value),
    var: contextMap,
    req: {
      json: async () => ({}),
      header: (_name: string) => undefined,
      param: (_key: string) => undefined,
      query: (_key: string) => undefined,
    },
    json: (object: unknown, status?: number) => {
      return new Response(JSON.stringify(object), {
        status: status || 200,
        headers: { 'content-type': 'application/json' },
      });
    },
    status: (_code: number) => context,
    header: (_name: string, _value: string) => context,
  } as unknown as Context<{ Variables: DatabaseContextVariables }>;

  return context;
}

/**
 * Helper to extract DatabaseContext from test context
 */
export function getTestDatabaseContext(
  context: Context<{ Variables: DatabaseContextVariables }>
): IDatabaseContext {
  const dbContext = context.get('dbContext');
  if (!dbContext) {
    throw new Error('Test context does not have DatabaseContext set');
  }
  return dbContext;
}
