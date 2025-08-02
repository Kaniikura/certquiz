/**
 * In-Memory Unit of Work Provider
 *
 * Test implementation of IUnitOfWorkProvider that uses in-memory repositories
 * for isolated testing without database dependencies.
 */

import {
  InMemoryAuthUserRepository,
  InMemoryQuestionRepository,
  InMemoryQuizRepository,
  InMemoryUnitOfWork,
  InMemoryUserRepository,
} from '@/test-support/fakes';
import type { IUnitOfWork } from './IUnitOfWork';
import type { IUnitOfWorkProvider } from './IUnitOfWorkProvider';

/**
 * Test Unit of Work provider using in-memory storage
 *
 * This provider uses in-memory repositories that store data in memory,
 * providing test isolation and fast execution without database overhead.
 * Data persists across unit of work instances within the same provider
 * instance to support integration testing scenarios.
 */
export class InMemoryUnitOfWorkProvider implements IUnitOfWorkProvider {
  // Shared repository instances to persist data across UoW instances
  private readonly authUserRepository: InMemoryAuthUserRepository;
  private readonly userRepository: InMemoryUserRepository;
  private readonly quizRepository: InMemoryQuizRepository;
  private readonly questionRepository: InMemoryQuestionRepository;

  constructor() {
    // Create shared repository instances that persist data across UoW instances
    // This mimics database behavior where data persists between transactions
    this.authUserRepository = new InMemoryAuthUserRepository();
    this.userRepository = new InMemoryUserRepository();
    this.quizRepository = new InMemoryQuizRepository();
    this.questionRepository = new InMemoryQuestionRepository();
  }

  /**
   * Execute an operation within a simulated transaction
   *
   * Creates a new in-memory unit of work, executes the operation,
   * and simulates commit/rollback behavior without actual database calls.
   */
  async execute<T>(operation: (uow: IUnitOfWork) => Promise<T>): Promise<T> {
    // Create a new UoW instance with shared repositories
    const uow = new InMemoryUnitOfWork(
      this.authUserRepository,
      this.userRepository,
      this.quizRepository,
      this.questionRepository
    );

    await uow.begin();

    try {
      const result = await operation(uow);
      await uow.commit();
      return result;
    } catch (error) {
      await uow.rollback();
      throw error;
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
