/**
 * Test helpers for Ambient Unit of Work pattern
 */

import type { IUserRepository as IAuthUserRepository } from '@api/features/auth/domain';
import type { IQuestionRepository } from '@api/features/question/domain';
import type { IQuizRepository } from '@api/features/quiz/domain';
import type { IUserRepository } from '@api/features/user/domain';
import type { IUnitOfWork } from '@api/infra/db/IUnitOfWork';
import type { TransactionVariables } from '@api/middleware/transaction';
import type { Context } from 'hono';
import {
  InMemoryAuthUserRepository,
  InMemoryQuestionRepository,
  InMemoryQuizRepository,
  InMemoryUnitOfWork,
  InMemoryUserRepository,
} from './domain/fakes';

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
 * Creates a test context with an ambient Unit of Work.
 * This simulates the middleware-created context for testing.
 *
 * @param repositories - Optional custom repositories to use
 * @returns Context with UoW set in variables
 */
export function createTestContext(
  repositories?: RepositorySet
): Context<{ Variables: TransactionVariables }> {
  const uow = new InMemoryUnitOfWork(
    repositories?.authUser || new InMemoryAuthUserRepository(),
    repositories?.user || new InMemoryUserRepository(),
    repositories?.quiz || new InMemoryQuizRepository(),
    repositories?.question || new InMemoryQuestionRepository()
  );

  const contextMap = new Map<string, unknown>();
  contextMap.set('uow', uow);

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
  } as unknown as Context<{ Variables: TransactionVariables }>;

  return context;
}

/**
 * Helper to create dependencies for ambient route handlers
 */
export interface TestDependencies<T> {
  create(): T;
}

/**
 * Creates test dependencies with fake repositories
 */
export function createTestDependencies<T>(
  factory: (repos: {
    authUserRepo?: IAuthUserRepository;
    userRepo?: IUserRepository;
    quizRepo?: IQuizRepository;
    questionRepo?: IQuestionRepository;
  }) => T
): TestDependencies<T> {
  return {
    create: () =>
      factory({
        authUserRepo: new InMemoryAuthUserRepository(),
        userRepo: new InMemoryUserRepository(),
        quizRepo: new InMemoryQuizRepository(),
        questionRepo: new InMemoryQuestionRepository(),
      }),
  };
}

/**
 * Helper to extract UoW from test context
 */
export function getTestUnitOfWork(
  context: Context<{ Variables: TransactionVariables }>
): IUnitOfWork {
  const uow = context.get('uow');
  if (!uow) {
    throw new Error('Test context does not have UoW set');
  }
  return uow;
}
