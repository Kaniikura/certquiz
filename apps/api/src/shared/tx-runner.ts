/**
 * Transaction Runner Interface
 * @fileoverview Abstraction layer for transaction handling to enable test-time substitution
 *
 * This is a temporary shim to fix test issues while migrating to IUnitOfWork pattern.
 * It allows routes to run without a real database connection in tests.
 */

import type { TransactionContext } from '../infra/unit-of-work';

/**
 * Transaction runner interface
 * Provides a way to execute operations within a transaction context
 */
export interface TxRunner {
  /**
   * Execute a function within a transaction context
   * @param fn Function to execute with transaction context
   * @returns Promise resolving to the function's return value
   */
  run<T>(fn: (trx: TransactionContext) => Promise<T>): Promise<T>;
}

/**
 * Production transaction runner using Drizzle
 * Wraps the existing withTransaction function
 */
export class DrizzleTxRunner implements TxRunner {
  constructor(
    private readonly withTransaction: <T>(fn: (trx: TransactionContext) => Promise<T>) => Promise<T>
  ) {}

  async run<T>(fn: (trx: TransactionContext) => Promise<T>): Promise<T> {
    return this.withTransaction(fn);
  }
}

/**
 * No-op transaction runner for tests
 * Passes through operations without creating a real transaction
 */
export class NoopTxRunner implements TxRunner {
  constructor(private readonly mockTrx: TransactionContext) {}

  async run<T>(fn: (trx: TransactionContext) => Promise<T>): Promise<T> {
    // Execute the function with the mock transaction context
    return fn(this.mockTrx);
  }
}
