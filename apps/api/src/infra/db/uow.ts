import { db } from './client';
import type { LoggerPort } from '@api/shared/logger/LoggerPort';

/**
 * Unit of Work pattern for transaction management
 *
 * This provides transaction utilities and helpers specific to Drizzle.
 * The UnitOfWork class encapsulates a transaction context and provides
 * access to repository instances that operate within that transaction.
 */

// Export the transaction type for use in repositories
export type TransactionContext = Parameters<typeof db.transaction>[0] extends (
  tx: infer T
) => unknown
  ? T
  : never;

/**
 * Repository factory function type
 */
export type RepositoryFactory<T> = (tx: TransactionContext, logger: LoggerPort) => T;

/**
 * Unit of Work class that encapsulates transaction and repository access
 *
 * This class provides a higher-level abstraction over database transactions
 * by managing repository instances that share the same transaction context.
 * All repository operations performed through this UnitOfWork will be part
 * of the same database transaction.
 *
 * @example
 * ```typescript
 * return withUnitOfWork(async (uow) => {
 *   const user = await uow.users.findById(userId);
 *   const quiz = await uow.quizzes.save(newQuiz);
 *   // Both operations share the same transaction
 * });
 * ```
 */
export class UnitOfWork {
  private _users?: import('@api/features/auth/domain/repositories/DrizzleUserRepository').DrizzleUserRepository;
  private _quizzes?: import('@api/features/quiz/domain/repositories/DrizzleQuizRepository').DrizzleQuizRepository;

  constructor(
    private readonly tx: TransactionContext,
    private readonly logger: LoggerPort,
    private readonly repositoryFactories?: {
      userRepository?: RepositoryFactory<any>;
      quizRepository?: RepositoryFactory<any>;
    }
  ) {}

  /**
   * Get User repository instance tied to this transaction
   */
  get users(): import('@api/features/auth/domain/repositories/DrizzleUserRepository').DrizzleUserRepository {
    if (!this._users) {
      // Lazy import to avoid circular dependencies
      const { DrizzleUserRepository } = require('../../features/auth/domain/repositories/DrizzleUserRepository');
      this._users = new DrizzleUserRepository(this.tx, this.logger);
    }
    return this._users!;
  }

  /**
   * Get Quiz repository instance tied to this transaction
   */
  get quizzes(): import('@api/features/quiz/domain/repositories/DrizzleQuizRepository').DrizzleQuizRepository {
    if (!this._quizzes) {
      // Lazy import to avoid circular dependencies
      const { DrizzleQuizRepository } = require('../../features/quiz/domain/repositories/DrizzleQuizRepository');
      this._quizzes = new DrizzleQuizRepository(this.tx, this.logger);
    }
    return this._quizzes!;
  }

  /**
   * Get the underlying transaction context for advanced use cases
   * This should be used sparingly - prefer using the repository properties
   */
  get transaction(): TransactionContext {
    return this.tx;
  }
}

/**
 * Execute a function within a Unit of Work transaction
 *
 * This function creates a new transaction and UnitOfWork instance,
 * executes the provided function, and handles commit/rollback automatically.
 * The transaction will commit if the function completes successfully,
 * or rollback if an error is thrown.
 *
 * @param fn Function to execute within the Unit of Work
 * @param logger Logger instance for the Unit of Work
 * @param repositoryFactories Optional repository factories for testing
 * @returns Promise that resolves to the function's return value
 */
export async function withUnitOfWork<T>(
  fn: (uow: UnitOfWork) => Promise<T>,
  logger: LoggerPort,
  repositoryFactories?: {
    userRepository?: RepositoryFactory<any>;
    quizRepository?: RepositoryFactory<any>;
  }
): Promise<T> {
  return db.transaction(async (trx) => {
    const uow = new UnitOfWork(trx, logger, repositoryFactories);
    return fn(uow);
  });
}

/**
 * Legacy transaction function for backward compatibility
 *
 * This is a thin wrapper around Drizzle's transaction functionality.
 * Consider using withUnitOfWork for new code as it provides better
 * repository coordination and follows the Unit of Work pattern.
 *
 * @example
 * ```typescript
 * // Legacy pattern
 * return withTransaction(async (trx) => {
 *   const repo = new DrizzleUserRepository(trx, logger);
 *   return repo.findById(userId);
 * });
 * ```
 */
export const withTransaction = db.transaction.bind(db);
