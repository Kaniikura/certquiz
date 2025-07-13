/**
 * Test utilities package - Unified test infrastructure
 *
 * This package consolidates all cross-cutting test concerns into a single,
 * well-organized package following o3's barrel export pattern.
 *
 * Organization:
 * - Each folder has its own barrel (index.ts) that gathers all its files
 * - This root barrel only re-exports from folder barrels, never from files directly
 * - No duplication: when you add a new utility, update only the folder barrel
 *
 * Uses explicit exports to comply with project linting rules while maintaining
 * the same low-maintenance benefits as export *.
 *
 * @see https://docs.anthropic.com/en/docs/claude-code
 */

// Database utilities - everything that talks to Postgres/Testcontainers
export {
  buildDatabaseUrl,
  checkTestDbHealth,
  closeAllTrackedClients,
  closeTestDb,
  createTestContext,
  createTestDatabase,
  drizzleMigrate,
  extractDatabaseName,
  getTestDb,
  resetMigrationState,
  seedUsers,
  type TestDatabase,
  testSchema,
  verifyMigrationTables,
  withRollback,
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
  assertProcessSuccess,
  type ProcessResult,
  type RunProcessOptions,
  runBunScript,
  runProcessAndAssert,
} from './process';

// Runtime detection utilities - environment detection
export {
  getRuntimeName,
  isBun,
  isNode,
} from './runtime';
