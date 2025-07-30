import type { IAuthUserRepository } from '@api/features/auth/domain';
import type { IQuestionRepository } from '@api/features/question/domain';
import type { IQuizRepository } from '@api/features/quiz/domain';
import type { IUserRepository } from '@api/features/user/domain';
import type { TransactionVariables } from '@api/middleware/transaction';
import type { Context } from 'hono';

/**
 * Repository provider functions that extract repositories from ambient UoW.
 * These functions provide type-safe access to repositories within a transaction context.
 */

/**
 * Gets the AuthUser repository from the ambient transaction context.
 * @throws {Error} If no active transaction is found
 */
export function getAuthUserRepository<T extends TransactionVariables>(
  c: Context<{ Variables: T }>
): IAuthUserRepository {
  const uow = c.get('uow');
  if (!uow) {
    throw new Error('No active transaction. Ensure `createTransactionMiddleware` is applied.');
  }
  return uow.getAuthUserRepository();
}

/**
 * Gets the User repository from the ambient transaction context.
 * @throws {Error} If no active transaction is found
 */
export function getUserRepository<T extends TransactionVariables>(
  c: Context<{ Variables: T }>
): IUserRepository {
  const uow = c.get('uow');
  if (!uow) {
    throw new Error('No active transaction. Ensure `createTransactionMiddleware` is applied.');
  }
  return uow.getUserRepository();
}

/**
 * Gets the Quiz repository from the ambient transaction context.
 * @throws {Error} If no active transaction is found
 */
export function getQuizRepository<T extends TransactionVariables>(
  c: Context<{ Variables: T }>
): IQuizRepository {
  const uow = c.get('uow');
  if (!uow) {
    throw new Error('No active transaction. Ensure `createTransactionMiddleware` is applied.');
  }
  return uow.getQuizRepository();
}

/**
 * Gets the Question repository from the ambient transaction context.
 * @throws {Error} If no active transaction is found
 */
export function getQuestionRepository<T extends TransactionVariables>(
  c: Context<{ Variables: T }>
): IQuestionRepository {
  const uow = c.get('uow');
  if (!uow) {
    throw new Error('No active transaction. Ensure `createTransactionMiddleware` is applied.');
  }
  return uow.getQuestionRepository();
}
