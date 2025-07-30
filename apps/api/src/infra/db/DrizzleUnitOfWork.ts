/**
 * Drizzle ORM specific Unit of Work implementation
 *
 * This implementation leverages Drizzle's automatic transaction management
 * while providing a clean interface for future migration to explicit
 * transaction control if needed.
 *
 * @remarks
 * The Drizzle implementation uses the transaction callback pattern where:
 * - Transactions are automatically started when entering the callback
 * - Commits occur automatically when the callback completes successfully
 * - Rollbacks occur automatically when an error is thrown
 *
 * The begin/commit/rollback methods are included for interface compatibility
 * but perform no actual transaction control in this implementation.
 */

import { randomUUID } from 'node:crypto';
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
import type { IUnitOfWork } from './IUnitOfWork';
import type { TransactionContext } from './uow';

/**
 * Drizzle ORM specific Unit of Work implementation
 *
 * @example
 * ```typescript
 * const uow = new DrizzleUnitOfWork(tx, logger);
 * const userRepo = uow.getUserRepository();
 * const user = await userRepo.findById(userId);
 * await userRepo.save(user);
 * // All operations share the same transaction context
 * ```
 */
export class DrizzleUnitOfWork implements IUnitOfWork {
  private readonly repositoryCache = new Map<symbol, unknown>();
  private readonly transactionId: string;

  constructor(
    private readonly tx: TransactionContext,
    private readonly logger: LoggerPort
  ) {
    this.transactionId = this.generateTransactionId();
    this.logger.debug('DrizzleUnitOfWork created', {
      transactionId: this.transactionId,
    });
  }

  /**
   * Begin transaction (no-op in Drizzle as it's handled automatically)
   * Included for interface compatibility and future migration path
   */
  async begin(): Promise<void> {
    this.logger.debug('Transaction started (Drizzle auto-managed)', {
      transactionId: this.transactionId,
    });
  }

  /**
   * Commit transaction (no-op in Drizzle as it's handled automatically)
   * Included for interface compatibility and future migration path
   */
  async commit(): Promise<void> {
    this.logger.debug('Transaction committed (Drizzle auto-managed)', {
      transactionId: this.transactionId,
      repositoriesUsed: Array.from(this.repositoryCache.keys()),
    });
  }

  /**
   * Rollback transaction (no-op in Drizzle as it's handled automatically)
   * Included for interface compatibility and future migration path
   */
  async rollback(): Promise<void> {
    this.logger.debug('Transaction rolled back (Drizzle auto-managed)', {
      transactionId: this.transactionId,
      repositoriesUsed: Array.from(this.repositoryCache.keys()),
    });
  }

  /**
   * Get a repository instance by its token (type-safe)
   * Uses caching to ensure the same instance is returned for multiple calls
   */
  getRepository<T>(token: RepositoryToken<T>): T {
    if (!this.repositoryCache.has(token)) {
      const repo = this.createRepository(token);
      this.repositoryCache.set(token, repo);
      this.logger.debug('Repository created via token', {
        transactionId: this.transactionId,
        token: token.toString(),
      });
    }
    return this.repositoryCache.get(token) as T;
  }

  /**
   * Create a repository instance based on the provided token
   * @internal
   */
  private createRepository(token: symbol): unknown {
    switch (token) {
      case AUTH_USER_REPO_TOKEN:
        return new DrizzleAuthUserRepository(this.tx, this.logger);
      case USER_REPO_TOKEN:
        return new DrizzleUserRepository(this.tx, this.logger);
      case QUIZ_REPO_TOKEN:
        return new DrizzleQuizRepository(this.tx, this.logger);
      case QUESTION_REPO_TOKEN:
        return new DrizzleQuestionRepository(this.tx, this.logger);
      default:
        throw new Error(`Unknown repository token: ${token.toString()}`);
    }
  }

  /**
   * Generate a UUID-based transaction ID for logging purposes
   * Uses crypto.randomUUID() for secure, unique identifier generation
   */
  private generateTransactionId(): string {
    return `tx_${randomUUID()}`;
  }
}
