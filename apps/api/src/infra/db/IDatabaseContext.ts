/**
 * Database Context interface for unified database operations
 *
 * This interface provides a simplified, single-tier approach to database operations,
 * replacing the two-tier UnitOfWork pattern (Provider + UnitOfWork) with a unified
 * context that handles both transactions and repository access.
 *
 * Key benefits over UnitOfWork pattern:
 * - Simplified API: Single interface instead of Provider + UnitOfWork
 * - Better encapsulation: Context handles both transactions and repositories
 * - More intuitive: Direct access to both transactional and non-transactional operations
 * - Consistent with modern architectural patterns
 *
 * @example
 * ```typescript
 * // Transactional operations
 * await dbContext.withinTransaction(async (ctx) => {
 *   const userRepo = ctx.getRepository(USER_REPO_TOKEN);
 *   const quizRepo = ctx.getRepository(QUIZ_REPO_TOKEN);
 *
 *   // All operations share the same transaction
 *   const user = await userRepo.findById(userId);
 *   const quiz = await quizRepo.save(quizSession);
 * });
 *
 * // Non-transactional operations (for read-only queries)
 * const userRepo = dbContext.getRepository(USER_REPO_TOKEN);
 * const user = await userRepo.findById(userId);
 * ```
 */

import type { RepositoryToken } from '@api/shared/types/RepositoryToken';

/**
 * Transaction Context interface
 *
 * Provides repository access within a transaction boundary.
 * Repository instances obtained from this context share the same transaction.
 */
export interface ITransactionContext {
  /**
   * Get a repository instance that operates within the current transaction
   *
   * @param token - Type-safe repository token
   * @returns Repository instance that shares the transaction context
   * @remarks
   * - All repositories obtained from the same transaction context share the same transaction
   * - Repository instances are cached per transaction for consistency
   * - Changes made through these repositories are committed or rolled back together
   *
   * @example
   * ```typescript
   * await dbContext.withinTransaction(async (ctx) => {
   *   const userRepo = ctx.getRepository(USER_REPO_TOKEN);
   *   const sameUserRepo = ctx.getRepository(USER_REPO_TOKEN); // Same instance
   *   // userRepo === sameUserRepo (cached)
   * });
   * ```
   */
  getRepository<T>(token: RepositoryToken<T>): T;
}

/**
 * Database Context interface
 *
 * Main interface for database operations, providing both transactional and
 * non-transactional repository access through a unified API.
 */
export interface IDatabaseContext {
  /**
   * Execute operations within a database transaction
   *
   * @param operation - Async function to execute within transaction context
   * @returns The result of the operation
   * @throws Any error thrown by the operation will cause transaction rollback
   *
   * @remarks
   * - Automatic transaction management: commit on success, rollback on error
   * - Repository instances are cached within the transaction context
   * - Transaction isolation is maintained according to database settings
   * - Nested transactions are not supported in current implementation
   *
   * @example
   * ```typescript
   * const result = await dbContext.withinTransaction(async (ctx) => {
   *   const userRepo = ctx.getRepository(USER_REPO_TOKEN);
   *   const user = await userRepo.findById(userId);
   *   user.updateProfile(data);
   *   await userRepo.save(user);
   *   return user;
   * });
   * ```
   */
  withinTransaction<T>(operation: (ctx: ITransactionContext) => Promise<T>): Promise<T>;

  /**
   * Get a repository instance for non-transactional operations
   *
   * @param token - Type-safe repository token
   * @returns Repository instance for standalone operations
   * @remarks
   * - Each call returns a fresh repository instance (no caching)
   * - Suitable for read-only operations or single repository operations
   * - For multi-repository operations requiring consistency, use withinTransaction
   *
   * @example
   * ```typescript
   * // Read-only query
   * const userRepo = dbContext.getRepository(USER_REPO_TOKEN);
   * const user = await userRepo.findById(userId);
   *
   * // Single repository operation
   * const quizRepo = dbContext.getRepository(QUIZ_REPO_TOKEN);
   * await quizRepo.incrementViewCount(quizId);
   * ```
   */
  getRepository<T>(token: RepositoryToken<T>): T;
}
