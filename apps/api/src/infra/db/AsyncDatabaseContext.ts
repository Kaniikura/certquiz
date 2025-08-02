/**
 * Async Database Context implementation using IDatabaseProvider
 * @fileoverview Database context that works with the new async provider pattern
 */

import { DrizzleAuthUserRepository } from '@api/features/auth/infrastructure/drizzle/DrizzleAuthUserRepository';
import { DrizzleQuestionRepository } from '@api/features/question/infrastructure/drizzle/DrizzleQuestionRepository';
import { DrizzleQuizRepository } from '@api/features/quiz/infrastructure/drizzle/DrizzleQuizRepository';
import { DrizzleUserRepository } from '@api/features/user/infrastructure/drizzle/DrizzleUserRepository';
import type { Logger } from '@api/infra/logger/root-logger';
import type { RepositoryToken } from '@api/shared/types/RepositoryToken';
import {
  AUTH_USER_REPO_TOKEN,
  QUESTION_REPO_TOKEN,
  QUIZ_REPO_TOKEN,
  USER_REPO_TOKEN,
} from '@api/shared/types/RepositoryToken';
import type { IDatabaseContext, ITransactionContext } from './IDatabaseContext';
import type { IDatabaseProvider } from './IDatabaseProvider';
import type { IUnitOfWork } from './IUnitOfWork';
import type { IUnitOfWorkProvider } from './IUnitOfWorkProvider';
import type { DB } from './types';
import type { TransactionContext } from './uow';

/**
 * Factory function for creating repository instances
 * Eliminates code duplication by centralizing repository creation logic
 * Returns unknown to match the established pattern for repository caching
 */
function createRepository(token: symbol, db: TransactionContext, logger: Logger): unknown {
  switch (token) {
    case AUTH_USER_REPO_TOKEN:
      return new DrizzleAuthUserRepository(db, logger);
    case USER_REPO_TOKEN:
      return new DrizzleUserRepository(db, logger);
    case QUIZ_REPO_TOKEN:
      return new DrizzleQuizRepository(db, logger);
    case QUESTION_REPO_TOKEN:
      return new DrizzleQuestionRepository(db, logger);
    default:
      throw new Error(`Unknown repository token: ${token.toString()}`);
  }
}

/**
 * Transaction context implementation for async database operations
 */
class AsyncTransactionContext implements ITransactionContext {
  private repositoryCache = new Map<symbol, unknown>();

  constructor(
    private readonly db: DB,
    private readonly logger: Logger
  ) {}

  getRepository<T>(token: RepositoryToken<T>): T {
    const tokenSymbol = token as symbol;

    if (this.repositoryCache.has(tokenSymbol)) {
      return this.repositoryCache.get(tokenSymbol) as T;
    }

    const repository = createRepository(token, this.db as TransactionContext, this.logger);
    this.repositoryCache.set(tokenSymbol, repository);

    return repository as T;
  }
}

// AsyncDatabaseAdapter removed - non-transactional repository access is not supported
// in async database contexts. Use withinTransaction() for all database operations.

/**
 * Options for AsyncDatabaseContext initialization
 */
interface AsyncDatabaseContextOptions {
  /**
   * Whether to automatically initialize the database connection on construction.
   * Defaults to true for production safety.
   * Set to false for testing scenarios where manual control is needed.
   */
  autoInitialize?: boolean;
}

/**
 * Async Database Context implementation
 *
 * Uses IDatabaseProvider for async database access with automatic initialization by default.
 * Provides proper transaction management and repository caching.
 *
 * Features:
 * - Auto-initialization by default (safe for production)
 * - Optional manual initialization for testing
 * - Thread-safe initialization with promise deduplication
 * - Clear error messages for debugging
 */
export class AsyncDatabaseContext implements IDatabaseContext {
  private repositoryCache = new Map<symbol, unknown>();
  private db: DB | null = null;
  private initPromise: Promise<void> | null = null;

  constructor(
    private readonly logger: Logger,
    private readonly databaseProvider: IDatabaseProvider,
    private readonly options: AsyncDatabaseContextOptions = {},
    private readonly unitOfWorkProvider?: IUnitOfWorkProvider
  ) {
    // Auto-initialize by default (unless explicitly disabled)
    if (this.options.autoInitialize !== false) {
      this.initPromise = this.initialize().catch((error) => {
        this.logger.error('Failed to auto-initialize AsyncDatabaseContext', { error });
        throw error;
      });
    }
  }

  /**
   * Initialize the database connection.
   * Safe to call multiple times - subsequent calls return the same promise.
   *
   * @returns Promise that resolves when initialization is complete
   */
  async initialize(): Promise<void> {
    if (!this.initPromise) {
      this.initPromise = this._doInitialize();
    }
    return this.initPromise;
  }

  /**
   * Perform the actual initialization
   * @internal
   */
  private async _doInitialize(): Promise<void> {
    if (!this.db) {
      this.db = await this.databaseProvider.getDatabase();
      this.logger.debug('AsyncDatabaseContext initialized with database connection');
    }
  }

  async withinTransaction<T>(operation: (ctx: ITransactionContext) => Promise<T>): Promise<T> {
    // Wait for any pending initialization
    if (this.initPromise) {
      await this.initPromise;
    } else if (!this.db) {
      // If no init promise and no db, initialize now
      await this.initialize();
    }

    const db = this.db;
    if (!db) {
      throw new Error('Database not initialized after initialize() call');
    }

    return db.transaction(async (tx) => {
      const context = new AsyncTransactionContext(tx, this.logger);
      return operation(context);
    });
  }

  /**
   * Execute operations within a Unit of Work transaction
   *
   * This method integrates with the Unit of Work pattern to enable atomic operations
   * across multiple aggregates. It's particularly useful for cross-aggregate business
   * operations like quiz completion with user progress updates.
   *
   * @param operation - Function that receives a Unit of Work and performs business operations
   * @returns Promise<T> - Result of the operation
   * @throws Error if Unit of Work provider is not configured
   */
  async executeWithUnitOfWork<T>(operation: (unitOfWork: IUnitOfWork) => Promise<T>): Promise<T> {
    if (!this.unitOfWorkProvider) {
      throw new Error(
        'Unit of Work provider not configured for this context. ' +
          'Pass an IUnitOfWorkProvider to the constructor to enable Unit of Work operations.'
      );
    }

    return this.unitOfWorkProvider.execute(async (unitOfWork) => {
      try {
        this.logger.debug('Unit of Work transaction started');

        const result = await operation(unitOfWork);

        this.logger.debug('Unit of Work transaction completed successfully');

        return result;
      } catch (error) {
        this.logger.error('Unit of Work transaction failed, rolling back', { error });
        throw error;
      }
    });
  }

  getRepository<T>(token: RepositoryToken<T>): T {
    if (!this.db) {
      throw new Error(
        'AsyncDatabaseContext not initialized. This is likely a bug - ' +
          'context should auto-initialize unless explicitly disabled for testing. ' +
          'If this is a test, ensure you call initialize() before getRepository(). ' +
          'If this is production code, check that autoInitialize is not disabled.'
      );
    }

    const tokenSymbol = token as symbol;

    if (this.repositoryCache.has(tokenSymbol)) {
      return this.repositoryCache.get(tokenSymbol) as T;
    }

    const repository = createRepository(token, this.db as TransactionContext, this.logger);
    this.repositoryCache.set(tokenSymbol, repository);

    return repository as T;
  }
}
