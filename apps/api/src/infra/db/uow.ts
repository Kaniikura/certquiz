import { db } from './client';

/**
 * Unit of Work pattern for transaction management
 *
 * @deprecated Use IDatabaseContext and executeInDatabaseContext instead. This function will be removed in a future version.
 *
 * Migration example:
 * ```typescript
 * // Old pattern:
 * return withTransaction(async (trx) => {
 *   const result = await trx.select().from(users).where(eq(users.id, userId));
 *   await trx.insert(auditLog).values({ action: 'user_accessed' });
 *   return result;
 * });
 *
 * // New pattern:
 * return executeInDatabaseContext(dbContext, async (ctx) => {
 *   const userRepo = ctx.getRepository(USER_REPO_TOKEN);
 *   const user = await userRepo.findById(userId);
 *   // Use repository methods instead of direct SQL
 *   return user;
 * });
 * ```
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

/**
 * @deprecated Use IDatabaseContext and executeInDatabaseContext instead. This function will be removed in a future version.
 */
export const withTransaction: typeof db.transaction = async (fn, opts?) => db.transaction(fn, opts);

// Export the transaction type for use in repositories
export type TransactionContext = Parameters<typeof withTransaction>[0] extends (
  tx: infer T
) => unknown
  ? T
  : never;
