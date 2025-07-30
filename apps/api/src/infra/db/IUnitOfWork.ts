/**
 * Unit of Work interface for transaction management
 *
 * This interface follows the standard Unit of Work pattern, providing
 * a clean abstraction for managing database transactions and coordinating
 * multiple repository operations within a single transaction context.
 *
 * @example
 * ```typescript
 * await withUnitOfWork(async (uow) => {
 *   await uow.begin(); // Start transaction (Phase 1: no-op)
 *
 *   const userRepo = uow.getRepository(USER_REPO_TOKEN);
 *   const quizRepo = uow.getRepository(QUIZ_REPO_TOKEN);
 *
 *   // All operations share the same transaction
 *   const user = await userRepo.findById(userId);
 *   const quiz = await quizRepo.save(quizSession);
 *
 *   await uow.commit(); // Commit transaction (Phase 1: no-op)
 * });
 * ```
 *
 * @remarks
 * Phase 1 implementation uses Drizzle's automatic transaction management,
 * so begin/commit/rollback are no-ops. These methods are included for
 * interface compatibility and future migration to explicit transaction control.
 */

import type { RepositoryToken } from '@api/shared/types/RepositoryToken';

export interface IUnitOfWork {
  /**
   * Begin a new transaction
   *
   * @remarks
   * In Phase 1 (Drizzle implementation), this is a no-op as Drizzle
   * handles transaction lifecycle automatically within the transaction callback.
   * Included for interface compatibility with future implementations.
   */
  begin(): Promise<void>;

  /**
   * Commit the current transaction
   *
   * @remarks
   * In Phase 1 (Drizzle implementation), this is a no-op as Drizzle
   * automatically commits when the transaction callback completes successfully.
   * Included for interface compatibility with future implementations.
   */
  commit(): Promise<void>;

  /**
   * Rollback the current transaction
   *
   * @remarks
   * In Phase 1 (Drizzle implementation), this is a no-op as Drizzle
   * automatically rolls back when an error is thrown in the transaction callback.
   * Included for interface compatibility with future implementations.
   */
  rollback(): Promise<void>;

  /**
   * Get a repository instance by its token (type-safe)
   *
   * This method provides type-safe repository access using tokens,
   * eliminating the need for casting or type assertions.
   *
   * @param token - Type-safe repository token
   * @returns Repository instance that operates within the current transaction context
   *
   * @example
   * ```typescript
   * const userRepo = uow.getRepository(USER_REPO_TOKEN);
   * // userRepo is correctly typed as IUserRepository
   * ```
   */
  getRepository<T>(token: RepositoryToken<T>): T;

  // Future repositories can be added by creating new tokens
}
