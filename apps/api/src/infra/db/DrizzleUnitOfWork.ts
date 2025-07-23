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
import { DrizzleUserRepository as AuthDrizzleUserRepository } from '@api/features/auth/domain/repositories/DrizzleUserRepository';
import type { IUserRepository as IAuthUserRepository } from '@api/features/auth/domain/repositories/IUserRepository';
import { DrizzleQuestionRepository } from '@api/features/question/domain/repositories/DrizzleQuestionRepository';
import type { IQuestionRepository } from '@api/features/question/domain/repositories/IQuestionRepository';
import { DrizzleQuizRepository } from '@api/features/quiz/domain/repositories/DrizzleQuizRepository';
import type { IQuizRepository } from '@api/features/quiz/domain/repositories/IQuizRepository';
import { DrizzleUserRepository } from '@api/features/user/domain/repositories/DrizzleUserRepository';
import type { IUserRepository } from '@api/features/user/domain/repositories/IUserRepository';
import type { LoggerPort } from '@api/shared/logger/LoggerPort';
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
  private readonly repositoryCache = new Map<string, unknown>();
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
   * Get Auth User repository instance
   * Uses caching to ensure the same instance is returned for multiple calls
   */
  getAuthUserRepository(): IAuthUserRepository {
    const key = 'authUser';
    if (!this.repositoryCache.has(key)) {
      const repo = new AuthDrizzleUserRepository(this.tx, this.logger);
      this.repositoryCache.set(key, repo);
      this.logger.debug('Auth user repository created', {
        transactionId: this.transactionId,
        repository: key,
      });
    }
    return this.repositoryCache.get(key) as IAuthUserRepository;
  }

  /**
   * Get User repository instance
   * Uses caching to ensure the same instance is returned for multiple calls
   */
  getUserRepository(): IUserRepository {
    const key = 'user';
    if (!this.repositoryCache.has(key)) {
      const repo = new DrizzleUserRepository(this.tx, this.logger);
      this.repositoryCache.set(key, repo);
      this.logger.debug('User repository created', {
        transactionId: this.transactionId,
        repository: key,
      });
    }
    return this.repositoryCache.get(key) as IUserRepository;
  }

  /**
   * Get Quiz repository instance
   * Uses caching to ensure the same instance is returned for multiple calls
   */
  getQuizRepository(): IQuizRepository {
    const key = 'quiz';
    if (!this.repositoryCache.has(key)) {
      const repo = new DrizzleQuizRepository(this.tx, this.logger);
      this.repositoryCache.set(key, repo);
      this.logger.debug('Quiz repository created', {
        transactionId: this.transactionId,
        repository: key,
      });
    }
    return this.repositoryCache.get(key) as IQuizRepository;
  }

  /**
   * Get Question repository instance
   * Uses caching to ensure the same instance is returned for multiple calls
   */
  getQuestionRepository(): IQuestionRepository {
    const key = 'question';
    if (!this.repositoryCache.has(key)) {
      const repo = new DrizzleQuestionRepository(this.tx, this.logger);
      this.repositoryCache.set(key, repo);
      this.logger.debug('Question repository created', {
        transactionId: this.transactionId,
        repository: key,
      });
    }
    return this.repositoryCache.get(key) as IQuestionRepository;
  }

  /**
   * Generate a UUID-based transaction ID for logging purposes
   * Uses crypto.randomUUID() for secure, unique identifier generation
   */
  private generateTransactionId(): string {
    return `tx_${randomUUID()}`;
  }
}
