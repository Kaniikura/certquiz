/**
 * Transaction Runner Test Helpers
 * @fileoverview Test utilities for transaction handling in tests
 */

import type { TransactionContext } from '@api/infra/unit-of-work';
import { NoopTxRunner } from '@api/shared/tx-runner';

/**
 * Create a noop transaction runner for tests
 * This allows tests to run without a real database connection
 *
 * @param mockTrx - Optional mock transaction context. If not provided, creates a minimal mock.
 * @returns NoopTxRunner instance for testing
 */
export function createNoopTxRunner(mockTrx?: TransactionContext): NoopTxRunner {
  // If no mock provided, create a minimal one
  const trx = mockTrx || ({} as TransactionContext);
  return new NoopTxRunner(trx);
}
