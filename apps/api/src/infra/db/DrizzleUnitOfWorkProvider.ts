/**
 * Drizzle Unit of Work Provider
 *
 * Production implementation of IUnitOfWorkProvider that uses Drizzle ORM
 * and PostgreSQL transactions for data consistency.
 */

import type { LoggerPort } from '@api/shared/logger/LoggerPort';
import { getDb } from './client';
import type { IUnitOfWork } from './IUnitOfWork';
import type { IUnitOfWorkProvider } from './IUnitOfWorkProvider';
import { UnitOfWorkFactory, withUnitOfWork } from './UnitOfWorkFactory';

/**
 * Production Unit of Work provider using Drizzle ORM
 *
 * This provider creates real database transactions and ensures
 * all operations within a unit of work are atomic.
 */
export class DrizzleUnitOfWorkProvider implements IUnitOfWorkProvider {
  private readonly factory: UnitOfWorkFactory;

  constructor(private readonly logger: LoggerPort) {
    this.factory = new UnitOfWorkFactory(logger);
  }

  /**
   * Execute an operation within a database transaction
   *
   * Creates a new database transaction, executes the operation,
   * and automatically commits on success or rolls back on failure.
   */
  async execute<T>(operation: (uow: IUnitOfWork) => Promise<T>): Promise<T> {
    const db = getDb();
    return withUnitOfWork(db, this.factory, operation);
  }
}
