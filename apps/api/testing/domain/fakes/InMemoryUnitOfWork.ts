/**
 * In-Memory Unit of Work implementation for unit testing
 *
 * This provides a test double that implements the IUnitOfWork interface
 * without requiring actual database connections. Useful for testing
 * business logic in isolation from database infrastructure.
 */

import type { IAuthUserRepository } from '@api/features/auth/domain';
import type { IQuestionRepository } from '@api/features/question/domain';
import type { IQuizRepository } from '@api/features/quiz/domain';
import type { IUserRepository } from '@api/features/user/domain';
import type { IUnitOfWork } from '@api/infra/db/IUnitOfWork';
import type { RepositoryToken } from '@api/shared/types/RepositoryToken';
import {
  AUTH_USER_REPO_TOKEN,
  QUESTION_REPO_TOKEN,
  QUIZ_REPO_TOKEN,
  USER_REPO_TOKEN,
} from '@api/shared/types/RepositoryToken';
import { InMemoryAuthUserRepository } from './InMemoryAuthUserRepository';
import { InMemoryQuestionRepository } from './InMemoryQuestionRepository';
import { InMemoryQuizRepository } from './InMemoryQuizRepository';
import { InMemoryUserRepository } from './InMemoryUserRepository';

/**
 * In-Memory Unit of Work implementation for testing
 *
 * Simulates transaction behavior without actual database transactions.
 * All operations are performed in-memory.
 */
export class InMemoryUnitOfWork implements IUnitOfWork {
  private readonly repositoryCache = new Map<symbol, unknown>();
  private isTransactionActive = false;
  private isCommitted = false;
  private isRolledBack = false;

  constructor(
    authUserRepository?: IAuthUserRepository,
    userRepository?: IUserRepository,
    quizRepository?: IQuizRepository,
    questionRepository?: IQuestionRepository
  ) {
    // Initialize repositories in the cache
    if (authUserRepository) {
      this.repositoryCache.set(AUTH_USER_REPO_TOKEN, authUserRepository);
    }
    if (userRepository) {
      this.repositoryCache.set(USER_REPO_TOKEN, userRepository);
    }
    if (quizRepository) {
      this.repositoryCache.set(QUIZ_REPO_TOKEN, quizRepository);
    }
    if (questionRepository) {
      this.repositoryCache.set(QUESTION_REPO_TOKEN, questionRepository);
    }
  }

  async begin(): Promise<void> {
    if (this.isTransactionActive) {
      throw new Error('Transaction already active');
    }
    this.isTransactionActive = true;
    this.isCommitted = false;
    this.isRolledBack = false;
  }

  async commit(): Promise<void> {
    if (!this.isTransactionActive) {
      throw new Error('No active transaction');
    }
    if (this.isRolledBack) {
      throw new Error('Transaction already rolled back');
    }
    this.isCommitted = true;
    this.isTransactionActive = false;
  }

  async rollback(): Promise<void> {
    if (!this.isTransactionActive) {
      throw new Error('No active transaction');
    }
    if (this.isCommitted) {
      throw new Error('Transaction already committed');
    }
    this.isRolledBack = true;
    this.isTransactionActive = false;
  }

  /**
   * Get a repository instance by its token (type-safe)
   * Uses caching to ensure the same instance is returned for multiple calls
   */
  getRepository<T>(token: RepositoryToken<T>): T {
    if (!this.repositoryCache.has(token)) {
      const repo = this.createRepository(token);
      this.repositoryCache.set(token, repo);
    }
    return this.repositoryCache.get(token) as T;
  }

  /**
   * Create an in-memory repository instance based on the provided token
   * @internal
   */
  private createRepository(token: symbol): unknown {
    switch (token) {
      case AUTH_USER_REPO_TOKEN:
        return new InMemoryAuthUserRepository();
      case USER_REPO_TOKEN:
        return new InMemoryUserRepository();
      case QUIZ_REPO_TOKEN:
        return new InMemoryQuizRepository();
      case QUESTION_REPO_TOKEN:
        return new InMemoryQuestionRepository();
      default:
        throw new Error(`Unknown repository token: ${token.toString()}`);
    }
  }

  // Test helper methods
  isInTransaction(): boolean {
    return this.isTransactionActive;
  }

  hasCommitted(): boolean {
    return this.isCommitted;
  }

  hasRolledBack(): boolean {
    return this.isRolledBack;
  }
}
