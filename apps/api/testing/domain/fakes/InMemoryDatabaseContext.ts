/**
 * In-Memory Database Context implementation for testing
 *
 * Test implementation of IDatabaseContext that uses in-memory repositories
 * for isolated testing without database dependencies. Provides the same
 * unified interface as DrizzleDatabaseContext but with in-memory storage.
 *
 * Key benefits for testing:
 * - No database setup required
 * - Fast execution (in-memory operations)
 * - Test isolation through data clearing
 * - Simulated transaction behavior for testing edge cases
 * - Data persistence across operations within the same context instance
 */

import type { IDatabaseContext, ITransactionContext } from '@api/infra/db/IDatabaseContext';
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
 * In-Memory Transaction Context implementation for testing
 *
 * Simulates transaction behavior without actual database transactions.
 * Repository instances are cached within the transaction context to maintain
 * consistency during the transaction scope.
 */
class InMemoryTransactionContext implements ITransactionContext {
  private readonly repositoryCache = new Map<symbol, unknown>();
  private isTransactionActive = true;
  private isCommitted = false;
  private isRolledBack = false;

  constructor(
    private readonly sharedRepositories: {
      authUser: InMemoryAuthUserRepository;
      user: InMemoryUserRepository;
      quiz: InMemoryQuizRepository;
      question: InMemoryQuestionRepository;
    }
  ) {}

  /**
   * Get a repository instance that operates within the current transaction
   * Uses caching to ensure the same instance is returned for multiple calls
   */
  getRepository<T>(token: RepositoryToken<T>): T {
    if (!this.repositoryCache.has(token)) {
      const repo = this.getSharedRepository(token);
      this.repositoryCache.set(token, repo);
    }
    return this.repositoryCache.get(token) as T;
  }

  /**
   * Get the shared repository instance for the given token
   * This ensures data persistence across operations within the same context
   * @internal
   */
  private getSharedRepository(token: symbol): unknown {
    switch (token) {
      case AUTH_USER_REPO_TOKEN:
        return this.sharedRepositories.authUser;
      case USER_REPO_TOKEN:
        return this.sharedRepositories.user;
      case QUIZ_REPO_TOKEN:
        return this.sharedRepositories.quiz;
      case QUESTION_REPO_TOKEN:
        return this.sharedRepositories.question;
      default:
        throw new Error(`Unknown repository token: ${token.toString()}`);
    }
  }

  // Test helper methods for verifying transaction state
  isInTransaction(): boolean {
    return this.isTransactionActive;
  }

  hasCommitted(): boolean {
    return this.isCommitted;
  }

  hasRolledBack(): boolean {
    return this.isRolledBack;
  }

  /**
   * Mark transaction as committed (for testing)
   * @internal
   */
  commit(): void {
    if (!this.isTransactionActive) {
      throw new Error('No active transaction');
    }
    if (this.isRolledBack) {
      throw new Error('Transaction already rolled back');
    }
    this.isCommitted = true;
    this.isTransactionActive = false;
  }

  /**
   * Mark transaction as rolled back (for testing)
   * @internal
   */
  rollback(): void {
    if (!this.isTransactionActive) {
      throw new Error('No active transaction');
    }
    if (this.isCommitted) {
      throw new Error('Transaction already committed');
    }
    this.isRolledBack = true;
    this.isTransactionActive = false;
  }
}

/**
 * In-Memory Database Context implementation for testing
 *
 * Provides the same unified database access interface as DrizzleDatabaseContext
 * but uses in-memory repositories for fast, isolated testing. Data persists
 * across operations within the same context instance to support integration
 * testing scenarios.
 *
 * @example
 * ```typescript
 * const dbContext = new InMemoryDatabaseContext();
 *
 * // Transactional operations
 * await dbContext.withinTransaction(async (ctx) => {
 *   const userRepo = ctx.getRepository(USER_REPO_TOKEN);
 *   const quizRepo = ctx.getRepository(QUIZ_REPO_TOKEN);
 *   // All operations share the same in-memory data
 * });
 *
 * // Non-transactional read operation
 * const userRepo = dbContext.getRepository(USER_REPO_TOKEN);
 * const user = await userRepo.findById(userId);
 *
 * // Clear test data between tests
 * dbContext.clear();
 * ```
 */
export class InMemoryDatabaseContext implements IDatabaseContext {
  // Shared repository instances to persist data across operations
  private readonly authUserRepository: InMemoryAuthUserRepository;
  private readonly userRepository: InMemoryUserRepository;
  private readonly quizRepository: InMemoryQuizRepository;
  private readonly questionRepository: InMemoryQuestionRepository;

  constructor() {
    // Create shared repository instances that persist data across operations
    // This mimics database behavior where data persists between transactions
    this.authUserRepository = new InMemoryAuthUserRepository();
    this.userRepository = new InMemoryUserRepository();
    this.quizRepository = new InMemoryQuizRepository();
    this.questionRepository = new InMemoryQuestionRepository();
  }

  /**
   * Execute operations within a simulated transaction
   *
   * Creates a transaction context with cached repository instances,
   * executes the operation, and simulates commit/rollback behavior
   * without actual database calls.
   */
  async withinTransaction<T>(operation: (ctx: ITransactionContext) => Promise<T>): Promise<T> {
    const transactionContext = new InMemoryTransactionContext({
      authUser: this.authUserRepository,
      user: this.userRepository,
      quiz: this.quizRepository,
      question: this.questionRepository,
    });

    try {
      const result = await operation(transactionContext);
      transactionContext.commit();
      return result;
    } catch (error) {
      transactionContext.rollback();
      throw error;
    }
  }

  /**
   * Get a repository instance for non-transactional operations
   *
   * Returns the shared repository instance to maintain data consistency
   * across all operations within the same context instance.
   */
  getRepository<T>(token: RepositoryToken<T>): T {
    return this.getSharedRepository(token) as T;
  }

  /**
   * Get the shared repository instance for the given token
   * This ensures data persistence across operations within the same context
   * @internal
   */
  private getSharedRepository(token: symbol): unknown {
    switch (token) {
      case AUTH_USER_REPO_TOKEN:
        return this.authUserRepository;
      case USER_REPO_TOKEN:
        return this.userRepository;
      case QUIZ_REPO_TOKEN:
        return this.quizRepository;
      case QUESTION_REPO_TOKEN:
        return this.questionRepository;
      default:
        throw new Error(`Unknown repository token: ${token.toString()}`);
    }
  }

  /**
   * Clear all test data
   *
   * Resets all in-memory repositories to their initial empty state.
   * This should be called between test runs to ensure test isolation.
   */
  clear(): void {
    this.authUserRepository.clear();
    this.userRepository.clear();
    this.quizRepository.clear();
    this.questionRepository.clear();
  }

  /**
   * Get direct access to repositories for test assertions
   *
   * This is useful for tests that need to verify data state
   * or perform test-specific operations.
   */
  getRepositories() {
    return {
      authUser: this.authUserRepository,
      user: this.userRepository,
      quiz: this.quizRepository,
      question: this.questionRepository,
    };
  }
}
