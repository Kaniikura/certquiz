import type { ExtractTablesWithRelations } from 'drizzle-orm';
import type { PostgresJsTransaction } from 'drizzle-orm/postgres-js';
import { getTestDb } from './db';
import type { testSchema } from './test-schema';

// TODO: Replace with actual schema when implemented
type Schema = typeof testSchema;
type Relations = ExtractTablesWithRelations<Schema>;

type DrizzleTransaction = PostgresJsTransaction<Schema, Relations>;

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
export function withRollback<T>(fn: (tx: DrizzleTransaction) => Promise<T>): Promise<T>;
export function withRollback<T>(fn: () => Promise<T>): Promise<T>;
export async function withRollback<T>(
  fn: ((tx: DrizzleTransaction) => Promise<T>) | (() => Promise<T>)
): Promise<T> {
  const db = await getTestDb();
  let result: T | undefined;

  // Use Drizzle's transaction which automatically rolls back on error
  try {
    await db.transaction(async (tx) => {
      // Run the test function and capture result
      // Check if function expects transaction parameter
      if (fn.length === 1) {
        result = await (fn as (tx: DrizzleTransaction) => Promise<T>)(tx);
      } else {
        result = await (fn as () => Promise<T>)();
      }

      // Force rollback by throwing
      throw new Error('Test rollback');
    });
  } catch (error) {
    // Ignore our intentional rollback error
    if (error instanceof Error && error.message !== 'Test rollback') {
      throw error;
    }
  }

  // Return the captured result (we know it's defined because fn was called)
  return result as T;
}

/**
 * Create a test context with transaction isolation.
 * Useful for tests that need to share a transaction across multiple operations.
 *
 * @example
 * ```ts
 * describe('User service', () => {
 *   let ctx: TestContext;
 *
 *   beforeEach(async () => {
 *     ctx = await createTestContext();
 *   });
 *
 *   afterEach(async () => {
 *     await ctx.rollback();
 *   });
 *
 *   it('should work', async () => {
 *     await ctx.tx.insert(users).values({ name: 'Test' });
 *   });
 * });
 * ```
 */
export async function createTestContext() {
  const db = await getTestDb();
  let isRolledBack = false;

  // Start a new transaction
  const txPromise = db
    .transaction(async (tx) => {
      // Keep transaction open until rollback is called
      await new Promise<void>((_resolve, reject) => {
        const ctx = {
          tx,
          rollback: async () => {
            if (!isRolledBack) {
              isRolledBack = true;
              // Force rollback by throwing
              reject(new Error('Test rollback'));
            }
          },
        };

        // Make context available
        Object.assign(context, ctx);
      });
    })
    .catch((error: unknown) => {
      // Ignore our rollback error
      if (error instanceof Error && error.message !== 'Test rollback') {
        throw error;
      }
    });

  const context: {
    tx?: DrizzleTransaction;
    rollback?: () => Promise<void>;
  } = {};

  // Wait a bit for transaction to start
  await new Promise((resolve) => setTimeout(resolve, 10));

  if (!context.tx || !context.rollback) {
    throw new Error('Test context not initialized');
  }

  return {
    tx: context.tx,
    rollback: context.rollback,
    _txPromise: txPromise,
  };
}

export type TestContext = Awaited<ReturnType<typeof createTestContext>>;
