import { sql } from 'drizzle-orm';
import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { getPostgres } from '../../tests/containers/postgres';
import * as testSchema from './schema';

// TODO: Replace with actual schema when implemented
type Schema = typeof testSchema;

let testDb: PostgresJsDatabase<Schema> | undefined;
let sqlClient: postgres.Sql | undefined;

/**
 * Get or create a Drizzle database instance for tests.
 * Automatically connects to the test container.
 */
export async function getTestDb(): Promise<PostgresJsDatabase<Schema>> {
  if (testDb) return testDb;

  const container = await getPostgres();
  const connectionUri = container.getConnectionUri();

  // Create postgres client with test-specific config
  sqlClient = postgres(connectionUri, {
    max: 10, // Smaller pool for tests
    idle_timeout: 20,
    connect_timeout: 10,
  });

  testDb = drizzle(sqlClient, { schema: testSchema });

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
