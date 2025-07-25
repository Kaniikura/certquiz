/**
 * Unit of Work pattern facade
 *
 * This provides a stable import surface for the Unit of Work pattern,
 * hiding the database-specific implementation details. Handlers and
 * application code should import from this facade rather than directly
 * from the db module.
 *
 * The Unit of Work pattern provides:
 * - Transaction boundary management
 * - Repository instance management per transaction
 * - Consistent interface for future migration to full Clean Architecture
 *
 * @example Using the new Unit of Work pattern:
 * ```typescript
 * import { withUnitOfWork, unitOfWorkFactory, type IUnitOfWork } from '@/infra/unit-of-work';
 *
 * export async function handler(cmd: StartQuizCommand) {
 *   return withUnitOfWork(db, unitOfWorkFactory, async (uow: IUnitOfWork) => {
 *     const userRepo = uow.getUserRepository();
 *     const quizRepo = uow.getQuizRepository();
 *
 *     const user = await userRepo.findById(cmd.userId);
 *     const quiz = await quizRepo.findById(cmd.quizId);
 *
 *     // Business logic here
 *     await userRepo.save(user);
 *     await quizRepo.save(quiz);
 *   });
 * }
 * ```
 *
 * @example Legacy transaction pattern (for backward compatibility):
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

import { db } from './db/client';
import type { IUnitOfWork } from './db/IUnitOfWork';
import { UnitOfWorkFactory, withUnitOfWork } from './db/UnitOfWorkFactory';
import { createDomainLogger } from './logger/PinoLoggerAdapter';

// Re-export the factory and helper for external use
export { UnitOfWorkFactory };
export type { TransactionContext } from './db/uow';

// Create a singleton factory instance for the application
const logger = createDomainLogger('unit-of-work');
const unitOfWorkFactory = new UnitOfWorkFactory(logger);

// Export the legacy transaction pattern for backward compatibility
export { withTransaction } from './db/uow';

// Export a convenience function that uses the singleton factory
export async function executeInUnitOfWork<T>(
  callback: (uow: IUnitOfWork) => Promise<T>
): Promise<T> {
  return withUnitOfWork(db, unitOfWorkFactory, callback);
}
