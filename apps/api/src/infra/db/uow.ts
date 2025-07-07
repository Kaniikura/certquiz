import { db } from './client';

/**
 * Unit of Work pattern for transaction management
 *
 * This is a thin wrapper around Drizzle's transaction functionality.
 * As we implement slices and discover domain models, repositories will
 * use this to ensure all operations within a handler share the same
 * transaction context.
 *
 * @example
 * ```typescript
 * // In a handler
 * return withTransaction(async (trx) => {
 *   // All database operations here share the same transaction
 *   const result = await trx.select().from(users).where(eq(users.id, userId));
 *   await trx.insert(auditLog).values({ action: 'user_accessed' });
 *   return result;
 * });
 * ```
 */
export const withTransaction = db.transaction.bind(db);

// Export the transaction type for use in repositories
export type TransactionContext = Parameters<typeof withTransaction>[0] extends (
  tx: infer T
) => unknown
  ? T
  : never;
