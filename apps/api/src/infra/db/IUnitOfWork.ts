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
 *   const userRepo = uow.getUserRepository();
 *   const quizRepo = uow.getQuizRepository();
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

import type { IUserRepository } from '@api/features/auth/domain/repositories/IUserRepository';
import type { IQuizRepository } from '@api/features/quiz/domain/repositories/IQuizRepository';

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
   * Get the User repository instance for this unit of work
   *
   * @returns User repository that operates within the current transaction context
   */
  getUserRepository(): IUserRepository;

  /**
   * Get the Quiz repository instance for this unit of work
   *
   * @returns Quiz repository that operates within the current transaction context
   */
  getQuizRepository(): IQuizRepository;

  // Future repository accessors can be added here:
  // getQuestionRepository(): IQuestionRepository;
  // getProgressRepository(): IProgressRepository;
}
