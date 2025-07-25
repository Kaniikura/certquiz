/**
 * Fake Unit of Work implementation for unit testing
 *
 * This provides a test double that implements the IUnitOfWork interface
 * without requiring actual database connections. Useful for testing
 * business logic in isolation from database infrastructure.
 */

import type { IUserRepository as IAuthUserRepository } from '@api/features/auth/domain';
import type { IQuestionRepository } from '@api/features/question/domain';
import type { IQuizRepository } from '@api/features/quiz/domain';
import type { IUserRepository } from '@api/features/user/domain';
import type { IUnitOfWork } from '@api/infra/db/IUnitOfWork';
import { FakeAuthUserRepository } from './FakeAuthUserRepository';
import { FakeQuestionRepository } from './FakeQuestionRepository';
import { FakeQuizRepository } from './FakeQuizRepository';
import { FakeUserRepository } from './FakeUserRepository';

/**
 * Fake Unit of Work implementation for testing
 *
 * Simulates transaction behavior without actual database transactions.
 * All operations are performed in-memory.
 */
export class FakeUnitOfWork implements IUnitOfWork {
  private authUserRepository: FakeAuthUserRepository;
  private userRepository: FakeUserRepository;
  private quizRepository: FakeQuizRepository;
  private questionRepository: FakeQuestionRepository;
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
      (authUserRepository as FakeAuthUserRepository) || new FakeAuthUserRepository();
    this.userRepository = (userRepository as FakeUserRepository) || new FakeUserRepository();
    this.quizRepository = (quizRepository as FakeQuizRepository) || new FakeQuizRepository();
    this.questionRepository =
      (questionRepository as FakeQuestionRepository) || new FakeQuestionRepository();
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

/**
 * Factory for creating FakeUnitOfWork instances
 */
export class FakeUnitOfWorkFactory {
  private authUserRepository: FakeAuthUserRepository;
  private userRepository: FakeUserRepository;
  private quizRepository: FakeQuizRepository;
  private questionRepository: FakeQuestionRepository;

  constructor() {
    this.authUserRepository = new FakeAuthUserRepository();
    this.userRepository = new FakeUserRepository();
    this.quizRepository = new FakeQuizRepository();
    this.questionRepository = new FakeQuestionRepository();
  }

  create(): FakeUnitOfWork {
    // Use shared repository instances to persist data across UoW instances
    // This allows integration tests to simulate persistent storage
    return new FakeUnitOfWork(
      this.authUserRepository,
      this.userRepository,
      this.quizRepository,
      this.questionRepository
    );
  }

  // Test helper methods
  getAuthUserRepository(): FakeAuthUserRepository {
    return this.authUserRepository;
  }

  getUserRepository(): FakeUserRepository {
    return this.userRepository;
  }

  getQuizRepository(): FakeQuizRepository {
    return this.quizRepository;
  }

  getQuestionRepository(): FakeQuestionRepository {
    return this.questionRepository;
  }

  clear(): void {
    this.authUserRepository.clear();
    this.userRepository.clear();
    this.quizRepository.clear();
    this.questionRepository.clear();
  }
}

/**
 * Helper function to execute a callback with a fake unit of work
 * Mimics the behavior of withUnitOfWork but with fake implementation
 */
export async function withFakeUnitOfWork<T>(
  factory: FakeUnitOfWorkFactory,
  callback: (uow: IUnitOfWork) => Promise<T>
): Promise<T> {
  const uow = factory.create();
  await uow.begin();

  try {
    const result = await callback(uow);
    await uow.commit();
    return result;
  } catch (error) {
    await uow.rollback();
    throw error;
  }
}
