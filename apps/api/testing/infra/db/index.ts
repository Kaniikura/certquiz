/**
 * Database utilities barrel export
 */

// Fakes are exported from testing/domain instead to maintain proper layer separation
export { createTestDb, withTestDb } from './connection';
export { closeAllTrackedClients } from './container';
export { createTestDatabase } from './core';
export { drizzleMigrate, verifyMigrationTables } from './migrations';
export { testSchema } from './schema';
export { seedAdminUser, seedUsers } from './seeds';
export { withRollback } from './tx';
export type { TestDb } from './types';
