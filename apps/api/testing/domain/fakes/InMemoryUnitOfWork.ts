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
  private authUserRepository: InMemoryAuthUserRepository;
  private userRepository: InMemoryUserRepository;
  private quizRepository: InMemoryQuizRepository;
  private questionRepository: InMemoryQuestionRepository;
  private isTransactionActive = false;
  private isCommitted = false;
  private isRolledBack = false;

  constructor(
    authUserRepository?: IAuthUserRepository,
    userRepository?: IUserRepository,
    quizRepository?: IQuizRepository,
    questionRepository?: IQuestionRepository
  ) {
    this.authUserRepository =
      (authUserRepository as InMemoryAuthUserRepository) || new InMemoryAuthUserRepository();
    this.userRepository =
      (userRepository as InMemoryUserRepository) || new InMemoryUserRepository();
    this.quizRepository =
      (quizRepository as InMemoryQuizRepository) || new InMemoryQuizRepository();
    this.questionRepository =
      (questionRepository as InMemoryQuestionRepository) || new InMemoryQuestionRepository();
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

  getAuthUserRepository(): IAuthUserRepository {
    return this.authUserRepository;
  }

  getUserRepository(): IUserRepository {
    return this.userRepository;
  }

  getQuizRepository(): IQuizRepository {
    return this.quizRepository;
  }

  getQuestionRepository(): IQuestionRepository {
    return this.questionRepository;
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
