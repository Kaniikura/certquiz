/**
 * In-Memory Unit of Work Provider
 *
 * Test implementation of IUnitOfWorkProvider that uses in-memory fake repositories
 * for isolated testing without database dependencies.
 */

import { FakeUnitOfWorkFactory, withFakeUnitOfWork } from '@api/testing/domain/fakes';
import type { IUnitOfWork } from './IUnitOfWork';
import type { IUnitOfWorkProvider } from './IUnitOfWorkProvider';

/**
 * Test Unit of Work provider using in-memory storage
 *
 * This provider uses fake repositories that store data in memory,
 * providing test isolation and fast execution without database overhead.
 * Data persists across unit of work instances within the same provider
 * instance to support integration testing scenarios.
 */
export class InMemoryUnitOfWorkProvider implements IUnitOfWorkProvider {
  private readonly factory: FakeUnitOfWorkFactory;

  constructor() {
    // Create a single factory instance to persist data across UoW instances
    // This mimics database behavior where data persists between transactions
    this.factory = new FakeUnitOfWorkFactory();
  }

  /**
   * Execute an operation within a simulated transaction
   *
   * Creates a new fake unit of work, executes the operation,
   * and simulates commit/rollback behavior without actual database calls.
   */
  async execute<T>(operation: (uow: IUnitOfWork) => Promise<T>): Promise<T> {
    return withFakeUnitOfWork(this.factory, operation);
  }

  /**
   * Clear all test data
   *
   * Resets all in-memory repositories to their initial empty state.
   * This should be called between test runs to ensure test isolation.
   */
  clear(): void {
    this.factory.clear();
  }

  /**
   * Get direct access to the fake factory for test assertions
   *
   * This is useful for tests that need to verify data state
   * or perform test-specific operations.
   */
  getFactory(): FakeUnitOfWorkFactory {
    return this.factory;
  }
}
