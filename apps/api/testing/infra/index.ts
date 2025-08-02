/**
 * Testing Infrastructure - Technical test utilities
 *
 * This package consolidates all infrastructure-level test concerns that are
 * not specific to business domains. These utilities handle the technical
 * foundation that domain-specific test utilities build upon.
 *
 * Organization:
 * - Each folder has its own barrel (index.ts) that gathers all its files
 * - This barrel only re-exports from folder barrels, never from files directly
 * - Pure technical concerns: databases, processes, runtime, configuration
 *
 * @see https://docs.anthropic.com/en/docs/claude-code
 */

// Database utilities - everything that talks to Postgres/Testcontainers
export {
  closeAllTrackedClients,
  createTestDatabase,
  createTestDb,
  drizzleMigrate,
  seedAdminUser,
  seedUsers,
  type TestDb,
  testSchema,
  verifyMigrationTables,
  withTestDb,
} from './db';
// Error utilities - pure utilities with no side effects
export {
  type DatabaseError,
  type ExecError,
  getExecErrorOutput,
  isDatabaseError,
  isExecError,
} from './errors';
// Process execution utilities - anything that shells out
export {
  type ProcessResult,
  runBunScript,
} from './process';
// Runtime detection utilities - environment detection
export {
  getRuntimeName,
  isBun,
  isNode,
} from './runtime';

// Vitest utilities - Vitest configuration helpers
export { mapTestEnvironmentVariables } from './vitest';
