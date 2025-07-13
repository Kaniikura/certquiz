import { sql } from 'drizzle-orm';
import { drizzle as baseDrizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres, { type Sql } from 'postgres';
import { getPostgres } from '../../tests/containers/postgres';
import * as testSchema from './schema';
import type { TestDb } from './types';

let testDb: PostgresJsDatabase<typeof testSchema> | undefined;
let sqlClient: postgres.Sql | undefined;

/**
 * Get or create a Drizzle database instance for tests.
 * Automatically connects to the test container.
 */
export async function getTestDb(): Promise<PostgresJsDatabase<typeof testSchema>> {
  if (testDb) return testDb;

  const container = await getPostgres();
  const connectionUri = container.getConnectionUri();

  // Create postgres client with test-specific config
  sqlClient = postgres(connectionUri, {
    max: 10, // Smaller pool for tests
    idle_timeout: 20,
    connect_timeout: 10,
  });

  testDb = baseDrizzle(sqlClient, { schema: testSchema });

  return testDb;
}

/**
 * Get the raw SQL client for advanced operations
 */
export async function getSqlClient(): Promise<postgres.Sql> {
  if (sqlClient) return sqlClient;

  await getTestDb(); // This will initialize sqlClient

  if (!sqlClient) {
    throw new Error('SQL client not initialized');
  }

  return sqlClient;
}

/**
 * Close test database connections
 */
export async function closeTestDb(): Promise<void> {
  if (sqlClient) {
    await sqlClient.end();
    sqlClient = undefined;
    testDb = undefined;
  }
}

/**
 * Health check for test database
 */
export async function checkTestDbHealth(): Promise<boolean> {
  try {
    const db = await getTestDb();
    await db.execute(sql`SELECT 1`);
    return true;
  } catch {
    return false;
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
