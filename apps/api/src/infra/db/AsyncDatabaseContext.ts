/**
 * Async Database Context implementation using IDatabaseProvider
 * @fileoverview Database context that works with the new async provider pattern
 */

import { DrizzleAuthUserRepository } from '@api/features/auth/infrastructure/drizzle/DrizzleAuthUserRepository';
import { DrizzleQuestionRepository } from '@api/features/question/infrastructure/drizzle/DrizzleQuestionRepository';
import { DrizzleQuizRepository } from '@api/features/quiz/infrastructure/drizzle/DrizzleQuizRepository';
import { DrizzleUserRepository } from '@api/features/user/infrastructure/drizzle/DrizzleUserRepository';
import type { Logger } from '@api/infra/logger';
import type { RepositoryToken } from '@api/shared/types/RepositoryToken';
import {
  AUTH_USER_REPO_TOKEN,
  QUESTION_REPO_TOKEN,
  QUIZ_REPO_TOKEN,
  USER_REPO_TOKEN,
} from '@api/shared/types/RepositoryToken';
import type { IDatabaseContext, ITransactionContext } from './IDatabaseContext';
import type { IDatabaseProvider } from './IDatabaseProvider';
import type { DB } from './types';
import type { TransactionContext } from './uow';

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

    const repository = this.createRepository(token, this.db as TransactionContext);
    this.repositoryCache.set(tokenSymbol, repository);

    return repository as T;
  }

  /**
   * Create a repository instance based on the provided token
   * @internal
   */
  private createRepository(token: symbol, db: TransactionContext): unknown {
    switch (token) {
      case AUTH_USER_REPO_TOKEN:
        return new DrizzleAuthUserRepository(db, this.logger);
      case USER_REPO_TOKEN:
        return new DrizzleUserRepository(db, this.logger);
      case QUIZ_REPO_TOKEN:
        return new DrizzleQuizRepository(db, this.logger);
      case QUESTION_REPO_TOKEN:
        return new DrizzleQuestionRepository(db, this.logger);
      default:
        throw new Error(`Unknown repository token: ${token.toString()}`);
    }
  }
}

// AsyncDatabaseAdapter removed - non-transactional repository access is not supported
// in async database contexts. Use withinTransaction() for all database operations.

/**
 * Async Database Context implementation
 *
 * Uses IDatabaseProvider for async database access instead of the singleton pattern.
 * Provides proper transaction management and repository caching.
 *
 * IMPORTANT: This implementation requires pre-initialization of the database connection
 * before non-transactional repository access. For test environments, this is handled
 * by the middleware initialization process.
 */
export class AsyncDatabaseContext implements IDatabaseContext {
  private repositoryCache = new Map<symbol, unknown>();
  private db: DB | null = null;

  constructor(
    private readonly logger: Logger,
    private readonly databaseProvider: IDatabaseProvider
  ) {}

  /**
   * Initialize the database connection.
   * Must be called before non-transactional repository access.
   */
  async initialize(): Promise<void> {
    if (!this.db) {
      this.db = await this.databaseProvider.getDatabase();
      this.logger.debug('AsyncDatabaseContext initialized with database connection');
    }
  }

  async withinTransaction<T>(operation: (ctx: ITransactionContext) => Promise<T>): Promise<T> {
    // Ensure database is initialized for transactions
    if (!this.db) {
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

  getRepository<T>(token: RepositoryToken<T>): T {
    if (!this.db) {
      throw new Error(
        'AsyncDatabaseContext not initialized. Call initialize() before accessing repositories.'
      );
    }

    const tokenSymbol = token as symbol;

    if (this.repositoryCache.has(tokenSymbol)) {
      return this.repositoryCache.get(tokenSymbol) as T;
    }

    const repository = this.createRepository(token, this.db as TransactionContext);
    this.repositoryCache.set(tokenSymbol, repository);

    return repository as T;
  }

  /**
   * Create a repository instance based on the provided token
   * @internal
   */
  private createRepository(token: symbol, db: TransactionContext): unknown {
    switch (token) {
      case AUTH_USER_REPO_TOKEN:
        return new DrizzleAuthUserRepository(db, this.logger);
      case USER_REPO_TOKEN:
        return new DrizzleUserRepository(db, this.logger);
      case QUIZ_REPO_TOKEN:
        return new DrizzleQuizRepository(db, this.logger);
      case QUESTION_REPO_TOKEN:
        return new DrizzleQuestionRepository(db, this.logger);
      default:
        throw new Error(`Unknown repository token: ${token.toString()}`);
    }
  }
}
