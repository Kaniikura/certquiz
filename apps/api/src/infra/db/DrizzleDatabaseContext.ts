/**
 * Drizzle ORM specific Database Context implementation
 *
 * This implementation replaces the two-tier UnitOfWork pattern (Provider + UnitOfWork)
 * with a unified Database Context that handles both transactional and non-transactional
 * repository access through a single, intuitive interface.
 *
 * Key improvements over UnitOfWork pattern:
 * - Unified API: Single interface for all database operations
 * - Better encapsulation: Context manages both transactions and repositories
 * - Simplified usage: Direct access without provider layer
 * - Type safety: Maintains type-safe repository resolution
 *
 * @remarks
 * Uses Drizzle's automatic transaction management:
 * - Transactions start automatically when entering withinTransaction callback
 * - Commits occur automatically when callback completes successfully
 * - Rollbacks occur automatically when an error is thrown
 * - Repository instances are cached within transaction scope for consistency
 */

import { DrizzleAuthUserRepository } from '@api/features/auth/infrastructure/drizzle/DrizzleAuthUserRepository';
import { DrizzleQuestionRepository } from '@api/features/question/infrastructure/drizzle/DrizzleQuestionRepository';
import { DrizzleQuizRepository } from '@api/features/quiz/infrastructure/drizzle/DrizzleQuizRepository';
import { DrizzleUserRepository } from '@api/features/user/infrastructure/drizzle/DrizzleUserRepository';
import type { LoggerPort } from '@api/shared/logger/LoggerPort';
import type { RepositoryToken } from '@api/shared/types/RepositoryToken';
import {
  AUTH_USER_REPO_TOKEN,
  QUESTION_REPO_TOKEN,
  QUIZ_REPO_TOKEN,
  USER_REPO_TOKEN,
} from '@api/shared/types/RepositoryToken';
import type { IDatabaseContext, ITransactionContext } from './IDatabaseContext';
import type { IUnitOfWork } from './IUnitOfWork';
import type { IUnitOfWorkProvider } from './IUnitOfWorkProvider';
import type { DB } from './types';
import type { TransactionContext } from './uow';

/**
 * Drizzle ORM specific Database Context implementation
 *
 * Provides unified database access through both transactional and non-transactional
 * operations. Replaces the UnitOfWork Provider + UnitOfWork pattern with a single,
 * more intuitive interface.
 *
 * @example
 * ```typescript
 * // Transactional operations
 * await dbContext.withinTransaction(async (ctx) => {
 *   const userRepo = ctx.getRepository(USER_REPO_TOKEN);
 *   const quizRepo = ctx.getRepository(QUIZ_REPO_TOKEN);
 *   // All operations share the same transaction
 * });
 *
 * // Non-transactional read operation
 * const userRepo = dbContext.getRepository(USER_REPO_TOKEN);
 * const user = await userRepo.findById(userId);
 * ```
 */
export class DrizzleDatabaseContext implements IDatabaseContext {
  constructor(
    private readonly logger: LoggerPort,
    private readonly unitOfWorkProvider: IUnitOfWorkProvider,
    private readonly db: DB
  ) {}

  /**
   * Execute operations within a database transaction
   *
   * Delegates to the UnitOfWorkProvider to create a transaction context,
   * then adapts the IUnitOfWork interface to ITransactionContext.
   * This implementation follows the composite pattern where IDatabaseContext
   * internally uses UnitOfWork components.
   */
  async withinTransaction<T>(operation: (ctx: ITransactionContext) => Promise<T>): Promise<T> {
    return this.unitOfWorkProvider.execute(async (uow) => {
      // Create an adapter that converts IUnitOfWork to ITransactionContext
      const transactionContext = new UnitOfWorkToTransactionContextAdapter(uow);

      try {
        this.logger.debug('Transaction started via UnitOfWork');

        const result = await operation(transactionContext);

        this.logger.debug('Transaction completed successfully via UnitOfWork');

        return result;
      } catch (error) {
        this.logger.error('Transaction failed via UnitOfWork, rolling back', {
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        throw error;
      }
    });
  }

  /**
   * Get a repository instance for non-transactional operations
   *
   * Creates a repository that uses auto-commit transactions for each operation.
   * This maintains compatibility with repository interfaces while providing atomicity.
   */
  getRepository<T>(token: RepositoryToken<T>): T {
    // Get database synchronously - it's already initialized or will be lazily
    const database = this.getDatabase();

    const repo = this.createRepository(token, database as TransactionContext);

    this.logger.debug('Non-transactional repository created', {
      token: token.toString(),
    });

    return repo as T;
  }

  /**
   * Get database instance
   * @internal
   */
  private getDatabase(): DB {
    if (this.db) {
      return this.db;
    }

    // No fallback - require explicit database initialization
    throw new Error(
      'Database not initialized. DrizzleDatabaseContext requires database to be provided during construction.'
    );
  }

  /**
   * Create a repository instance based on the provided token
   * Uses the main database connection for non-transactional operations
   * @internal
   */
  private createRepository(token: symbol, db: TransactionContext | DB): unknown {
    switch (token) {
      case AUTH_USER_REPO_TOKEN:
        return new DrizzleAuthUserRepository(db as TransactionContext, this.logger);
      case USER_REPO_TOKEN:
        return new DrizzleUserRepository(db as TransactionContext, this.logger);
      case QUIZ_REPO_TOKEN:
        return new DrizzleQuizRepository(db as TransactionContext, this.logger);
      case QUESTION_REPO_TOKEN:
        return new DrizzleQuestionRepository(db as TransactionContext, this.logger);
      default:
        throw new Error(`Unknown repository token: ${token.toString()}`);
    }
  }
}

/**
 * Adapter class that converts IUnitOfWork interface to ITransactionContext interface.
 * This enables the composite pattern where IDatabaseContext uses UnitOfWork internally
 * while providing a more intuitive API surface.
 */
class UnitOfWorkToTransactionContextAdapter implements ITransactionContext {
  constructor(private readonly unitOfWork: IUnitOfWork) {}

  /**
   * Get a repository instance that operates within the current transaction
   * Delegates directly to the underlying UnitOfWork's getRepository method
   */
  getRepository<T>(token: RepositoryToken<T>): T {
    return this.unitOfWork.getRepository(token);
  }
}
