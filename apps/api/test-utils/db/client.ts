/**
 * Test-specific database client
 * Contains all test-related database configuration and logic
 * Separated from production client to maintain clean architecture
 */

import postgres from 'postgres';
import {
  createDrizzleInstance,
  createIsolatedConnection,
  PoolConfigs,
  performHealthCheck,
  shutdownConnection,
  validateDatabaseUrl,
} from '../../src/infra/db/shared';
import type { DB } from '../../src/infra/db/types';

// Test client state
let _testPool: postgres.Sql | undefined;
let _testDb: DB | undefined;

/**
 * Initialize test database connection
 * Optimized for test environment with single connection
 */
function initializeTestDatabase(): { pool: postgres.Sql; db: DB } {
  if (!_testPool || !_testDb) {
    const databaseUrl = process.env.DATABASE_URL;

    // Validate DATABASE_URL using shared utility
    const validDatabaseUrl = validateDatabaseUrl(databaseUrl, {
      missingMessage: 'DATABASE_URL environment variable is required for tests',
    });

    // Create postgres connection with test-specific config
    const testPoolConfig = PoolConfigs.test();
    _testPool = postgres(validDatabaseUrl, testPoolConfig);

    // Create Drizzle instance using shared utility (no logging in tests)
    _testDb = createDrizzleInstance(_testPool, {
      enableLogging: false,
      environment: 'test',
    });
  }

  return { pool: _testPool as postgres.Sql, db: _testDb as DB };
}

/**
 * Get the test database connection pool
 */
export function getTestPool(): postgres.Sql {
  const { pool } = initializeTestDatabase();
  return pool;
}

/**
 * Get the test Drizzle database instance
 */
export function getTestDb(): DB {
  const { db } = initializeTestDatabase();
  return db;
}

/**
 * Test-specific health check
 */
export async function testPing(): Promise<void> {
  const pool = getTestPool();
  await performHealthCheck(pool);
}

/**
 * Test-specific database shutdown
 * Simplified for test environments without signal handling
 */
export async function shutdownTestDatabase(): Promise<void> {
  await shutdownConnection(_testPool, {
    timeout: 5,
    silent: true, // Keep test output clean
  });

  // Reset for clean state
  _testPool = undefined;
  _testDb = undefined;
}

/**
 * Create a test database connection for a specific URL
 * Used by TestContainers and isolated test databases
 */
export function createTestConnection(databaseUrl: string): {
  pool: postgres.Sql;
  db: DB;
  cleanup: () => Promise<void>;
} {
  return createIsolatedConnection(databaseUrl, PoolConfigs.test(), {
    enableLogging: false,
    environment: 'test',
    silentCleanup: true,
  });
}

// Export types for test usage
export type { DB, Queryable } from '../../src/infra/db/types';
