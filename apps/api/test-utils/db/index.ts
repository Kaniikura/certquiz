/**
 * Database utilities barrel export
 */

export { createTestDb, withTestDb } from './connection';
export { closeAllTrackedClients } from './container';
export { createTestDatabase, type TestDatabaseOptions } from './core';
export {
  FakeQuizRepository,
  FakeUnitOfWork,
  FakeUnitOfWorkFactory,
  FakeUserRepository,
  withFakeUnitOfWork,
} from './FakeUnitOfWork';
export { drizzleMigrate, resetMigrationState, verifyMigrationTables } from './migrations';
export { testSchema } from './schema';
export { seedAdminUser, seedUsers } from './seeds';
export { createTestContext, withRollback } from './tx';
export type { TestDb, TestTransaction } from './types';
