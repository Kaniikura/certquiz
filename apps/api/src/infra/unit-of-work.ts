/**
 * Unit of Work pattern facade
 *
 * This provides a stable import surface for the Unit of Work pattern,
 * hiding the database-specific implementation details. Handlers and
 * application code should import from this facade rather than directly
 * from the db module.
 *
 * @example
 * ```typescript
 * import { withTransaction } from '@/infra/unit-of-work';
 *
 * export async function handler(cmd: StartQuizCommand) {
 *   return withTransaction(async (trx) => {
 *     const repo = new DrizzleQuizRepository(trx);
 *     // business logic here
 *   });
 * }
 * ```
 */

export { type TransactionContext, withTransaction } from './db/uow';
