/**
 * Fake Unit of Work implementation for unit testing
 *
 * This provides a test double that implements the IUnitOfWork interface
 * without requiring actual database connections. Useful for testing
 * business logic in isolation from database infrastructure.
 */

import type { IUserRepository } from '@api/features/auth/domain/repositories/IUserRepository';
import type { IQuizRepository } from '@api/features/quiz/domain/repositories/IQuizRepository';
import type { IUnitOfWork } from '@api/infra/db/IUnitOfWork';
import { FakeQuizRepository } from './FakeQuizRepository';
import { FakeUserRepository } from './FakeUserRepository';

/**
 * Fake Unit of Work implementation for testing
 *
 * Simulates transaction behavior without actual database transactions.
 * All operations are performed in-memory.
 */
export class FakeUnitOfWork implements IUnitOfWork {
  private userRepository: FakeUserRepository;
  private quizRepository: FakeQuizRepository;
  private isTransactionActive = false;
  private isCommitted = false;
  private isRolledBack = false;

  constructor(userRepository?: FakeUserRepository, quizRepository?: FakeQuizRepository) {
    this.userRepository = userRepository || new FakeUserRepository();
    this.quizRepository = quizRepository || new FakeQuizRepository();
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

  getUserRepository(): IUserRepository {
    return this.userRepository;
  }

  getQuizRepository(): IQuizRepository {
    return this.quizRepository;
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
  private userRepository: FakeUserRepository;
  private quizRepository: FakeQuizRepository;

  constructor() {
    this.userRepository = new FakeUserRepository();
    this.quizRepository = new FakeQuizRepository();
  }

  create(): FakeUnitOfWork {
    // Create fresh repository instances for each UoW to ensure test isolation
    return new FakeUnitOfWork(new FakeUserRepository(), new FakeQuizRepository());
  }

  // Test helper methods
  getUserRepository(): FakeUserRepository {
    return this.userRepository;
  }

  getQuizRepository(): FakeQuizRepository {
    return this.quizRepository;
  }

  clear(): void {
    this.userRepository.clear();
    this.quizRepository.clear();
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
