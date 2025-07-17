/**
 * Unit of Work Factory
 *
 * Factory for creating Unit of Work instances with transaction context.
 * This factory abstracts the creation of UnitOfWork instances and provides
 * a helper function for executing operations within a transaction.
 */

import type { LoggerPort } from '@api/shared/logger/LoggerPort';
import { DrizzleUnitOfWork } from './DrizzleUnitOfWork';
import type { IUnitOfWork } from './IUnitOfWork';
import type { TransactionContext } from './uow';

/**
 * Factory for creating Unit of Work instances
 *
 * @example
 * ```typescript
 * const factory = new UnitOfWorkFactory(logger);
 * const uow = factory.create(transactionContext);
 * ```
 */
export class UnitOfWorkFactory {
  constructor(private readonly logger: LoggerPort) {}

  /**
   * Create a new Unit of Work instance with the given transaction context
   *
   * @param tx - The transaction context from Drizzle ORM
   * @returns A new DrizzleUnitOfWork instance
   */
  create(tx: TransactionContext): IUnitOfWork {
    return new DrizzleUnitOfWork(tx, this.logger);
  }
}

/**
 * Type for a database instance that supports transactions
 * This matches the shape of Drizzle's database instance
 */
interface TransactionalDatabase {
  transaction<T>(fn: (tx: TransactionContext) => Promise<T>): Promise<T>;
}

/**
 * Execute a callback within a Unit of Work transaction context
 *
 * This helper function:
 * 1. Starts a database transaction
 * 2. Creates a Unit of Work instance
 * 3. Executes the callback with the UoW instance
 * 4. Handles automatic commit/rollback based on success/failure
 *
 * @param db - The database instance with transaction support
 * @param factory - The Unit of Work factory
 * @param callback - The function to execute within the transaction
 * @returns The result of the callback
 *
 * @example
 * ```typescript
 * const result = await withUnitOfWork(db, factory, async (uow) => {
 *   const userRepo = uow.getUserRepository();
 *   const user = await userRepo.findById(userId);
 *   user.updateProfile(data);
 *   await userRepo.save(user);
 *   return user;
 * });
 * ```
 */
export async function withUnitOfWork<T>(
  db: TransactionalDatabase,
  factory: UnitOfWorkFactory,
  callback: (uow: IUnitOfWork) => Promise<T>
): Promise<T> {
  return db.transaction(async (tx) => {
    const uow = factory.create(tx);
    return callback(uow);
  });
}
