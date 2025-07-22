/**
 * Transaction Runner Test Helpers
 * @fileoverview Test utilities for transaction handling in tests
 */

import type { TransactionContext } from '@api/infra/unit-of-work';
import { NoopTxRunner } from '@api/shared/tx-runner';
import { vi } from 'vitest';

/**
 * Creates a mock transaction context for testing
 * Implements the Queryable interface methods that repositories expect
 */
function createMockTransactionContext(): TransactionContext {
  // Create a base mock with all required methods
  const mockTrx = {
    // Query builder methods - return self for chaining
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),

    // Execute method for raw SQL
    execute: vi.fn().mockResolvedValue({ rowCount: 0, rows: [] }),

    // Query method for the query builder
    query: vi.fn().mockReturnValue({
      findFirst: vi.fn().mockResolvedValue(null),
      findMany: vi.fn().mockResolvedValue([]),
    }),

    // Common query builder chain methods
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    returning: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    offset: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
  } as unknown as TransactionContext;

  return mockTrx;
}

/**
 * Create a noop transaction runner for tests
 * This allows tests to run without a real database connection
 *
 * @param mockTrx - Optional mock transaction context. If not provided, creates a complete mock.
 * @returns NoopTxRunner instance for testing
 */
export function createNoopTxRunner(mockTrx?: TransactionContext): NoopTxRunner {
  // If no mock provided, create a complete one with all required methods
  const trx = mockTrx || createMockTransactionContext();
  return new NoopTxRunner(trx);
}
