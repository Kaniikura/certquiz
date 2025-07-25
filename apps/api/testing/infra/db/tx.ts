import { getTestDb } from './connection';
import type { TestTransaction } from './types';

/**
 * Custom error class for intentional test rollbacks.
 * This distinguishes planned rollbacks from actual errors.
 */
class RollbackError extends Error {
  constructor() {
    super('Test rollback');
    this.name = 'RollbackError';
  }
}

/**
 * Execute a test function within a database transaction that will be rolled back.
 * This provides perfect isolation between tests without the overhead of resetting the entire database.
 *
 * @example
 * ```ts
 * // With transaction parameter
 * it('should create a user', async () => {
 *   await withRollback(async (tx) => {
 *     const user = await tx.insert(users).values({ name: 'Test' }).returning();
 *     expect(user).toHaveLength(1);
 *   });
 * });
 *
 * // Without transaction parameter
 * it('should handle errors', async () => {
 *   await expect(
 *     withRollback(async () => {
 *       throw new Error('Test error');
 *     })
 *   ).rejects.toThrow('Test error');
 * });
 * ```
 */
export function withRollback<T>(fn: (tx: TestTransaction) => Promise<T>): Promise<T>;
export function withRollback<T>(fn: () => Promise<T>): Promise<T>;
export async function withRollback<T>(
  fn: ((tx: TestTransaction) => Promise<T>) | (() => Promise<T>)
): Promise<T> {
  const db = await getTestDb();
  let result: T | undefined;

  // Use Drizzle's transaction which automatically rolls back on error
  try {
    await db.transaction(async (tx) => {
      // Run the test function and capture result
      // Check if function expects transaction parameter
      if (fn.length === 1) {
        result = await (fn as (tx: TestTransaction) => Promise<T>)(tx);
      } else {
        result = await (fn as () => Promise<T>)();
      }

      // Force rollback by throwing
      throw new RollbackError();
    });
  } catch (error) {
    // Ignore our intentional rollback error
    if (!(error instanceof RollbackError)) {
      throw error;
    }
  }

  // Return the captured result (we know it's defined because fn was called)
  return result as T;
}
