import path from 'node:path';
import { drizzle as baseDrizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres, { type Sql } from 'postgres';
import { getPostgres } from '../../../tests/containers/postgres';
import * as testSchema from './schema';
import type { TestDb } from './types';

let testDb: PostgresJsDatabase<typeof testSchema> | undefined;
let sqlClient: postgres.Sql | undefined;
let initPromise: Promise<PostgresJsDatabase<typeof testSchema>> | undefined;

/**
 * Internal function to initialize the test database.
 * This includes applying test-only schema after migrations.
 */
async function initializeTestDb(): Promise<PostgresJsDatabase<typeof testSchema>> {
  const container = await getPostgres();
  const connectionUri = container.getConnectionUri();

  // Create postgres client with test-specific config
  sqlClient = postgres(connectionUri, {
    max: 10, // Smaller pool for tests
    idle_timeout: 20,
    connect_timeout: 10,
  });

  // Apply test-only schema using Drizzle migrations
  try {
    const migrationsPath = path.join(__dirname, 'migrations');
    const tempDb = baseDrizzle(sqlClient);
    await migrate(tempDb, { migrationsFolder: migrationsPath });
  } catch (_error) {
    // Silently ignore if migrations don't exist or fail
    // This allows tests to run without test-specific tables
  }

  return baseDrizzle(sqlClient, { schema: testSchema });
}

/**
 * Get or create a Drizzle database instance for tests.
 * Automatically connects to the test container.
 * Thread-safe: concurrent calls will share the same initialization promise.
 */
export async function getTestDb(): Promise<PostgresJsDatabase<typeof testSchema>> {
  if (testDb) return testDb;

  // If initialization is in progress, wait for it
  if (initPromise) return initPromise;

  // Start initialization and cache the promise
  initPromise = initializeTestDb();

  try {
    testDb = await initPromise;
    return testDb;
  } catch (error) {
    // Clear the promise on failure so next call can retry
    initPromise = undefined;
    throw error;
  }
}

/**
 * Create a correctly-typed Drizzle instance for tests.
 * Injects the testSchema automatically so the result is always compatible with TestDb.
 *
 * @param client Optional postgres client to reuse, otherwise creates a new one
 * @returns TestDb instance with proper schema typing
 */
export function createTestDb(client?: Sql): TestDb {
  const sql = client ?? postgres({ max: 5 });
  return baseDrizzle(sql, { schema: testSchema });
}

/**
 * Loan-pattern helper for test database operations.
 * Automatically handles client creation and cleanup.
 *
 * @example
 * ```ts
 * await withTestDb(async (db) => {
 *   await seedUsers(db, 2);
 *   // ... test operations
 * });
 * ```
 */
export async function withTestDb<T>(fn: (db: TestDb) => Promise<T>): Promise<T> {
  const client = postgres({ max: 5 });
  try {
    const db = createTestDb(client);
    return await fn(db);
  } finally {
    await client.end({ timeout: 5 });
  }
}
