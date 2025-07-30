/**
 * Repository Token Type Definition
 * @fileoverview Type-safe token system for repository dependency injection
 */

import type { IAuthUserRepository } from '@api/features/auth/domain';
import type { IQuestionRepository } from '@api/features/question/domain';
import type { IQuizRepository } from '@api/features/quiz/domain';
import type { IUserRepository } from '@api/features/user/domain';

/**
 * Type-safe repository token
 * Phantom type ensures compile-time safety for repository resolution
 */
export type RepositoryToken<T> = symbol & { __type: T };

/**
 * Create a typed repository token
 * @internal
 */
function createToken<T>(name: string): RepositoryToken<T> {
  return Symbol(name) as RepositoryToken<T>;
}

// Repository Token Constants
export const AUTH_USER_REPO_TOKEN: RepositoryToken<IAuthUserRepository> =
  createToken<IAuthUserRepository>('AUTH_USER_REPOSITORY');

export const USER_REPO_TOKEN: RepositoryToken<IUserRepository> =
  createToken<IUserRepository>('USER_REPOSITORY');

export const QUIZ_REPO_TOKEN: RepositoryToken<IQuizRepository> =
  createToken<IQuizRepository>('QUIZ_REPOSITORY');

export const QUESTION_REPO_TOKEN: RepositoryToken<IQuestionRepository> =
  createToken<IQuestionRepository>('QUESTION_REPOSITORY');

/**
 * Type guard to check if a symbol is a repository token
 */
export function isRepositoryToken(value: unknown): value is RepositoryToken<unknown> {
  return typeof value === 'symbol';
}
