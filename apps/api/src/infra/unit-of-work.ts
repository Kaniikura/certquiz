/**
 * Database transaction facade
 *
 * This module provides transaction management utilities for database operations.
 * It exports the modern DatabaseContext pattern utilities and maintains backward
 * compatibility with the legacy transaction pattern.
 *
 * @example Using the DatabaseContext pattern (recommended):
 * ```typescript
 * import { executeInDatabaseContext } from '@api/infra/unit-of-work';
 *
 * export async function handler(dbContext: IDatabaseContext, cmd: StartQuizCommand) {
 *   return executeInDatabaseContext(dbContext, async (ctx) => {
 *     const userRepo = ctx.getRepository(USER_REPO_TOKEN);
 *     const quizRepo = ctx.getRepository(QUIZ_REPO_TOKEN);
 *
 *     const user = await userRepo.findById(cmd.userId);
 *     const quiz = await quizRepo.findById(cmd.quizId);
 *
 *     // Business logic here
 *     await userRepo.save(user);
 *     await quizRepo.save(quiz);
 *   });
 * }
 * ```
 */

// Re-export the factory and helper for external use
export type { TransactionContext } from './db/uow';

// Export DatabaseContext equivalent for new code
import type { IDatabaseContext, ITransactionContext } from './db/IDatabaseContext';

/**
 * Execute an operation within a database transaction context
 *
 * This is the preferred method for new code, providing a unified interface
 * for database operations that internally uses the UnitOfWork pattern.
 *
 * @param dbContext DatabaseContext instance
 * @param callback Function to execute within transaction
 * @returns The result of the operation
 *
 * @example
 * ```typescript
 * import { executeInDatabaseContext } from '@api/infra/unit-of-work';
 *
 * const result = await executeInDatabaseContext(dbContext, async (ctx) => {
 *   const userRepo = ctx.getRepository(USER_REPO_TOKEN);
 *   const user = await userRepo.findById(userId);
 *   // Business logic here
 *   return user;
 * });
 * ```
 */
export async function executeInDatabaseContext<T>(
  dbContext: IDatabaseContext,
  callback: (ctx: ITransactionContext) => Promise<T>
): Promise<T> {
  return dbContext.withinTransaction(callback);
}
