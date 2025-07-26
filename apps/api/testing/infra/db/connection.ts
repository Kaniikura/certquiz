import path from 'node:path';
import { drizzle as baseDrizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres, { type Sql } from 'postgres';
import { getRootLogger } from '../../../src/infra/logger';
import { getPostgres } from '../../../tests/containers/postgres';
import * as testSchema from './schema';
import type { TestDb } from './types';

// Map to store per-worker database instances
const workerDatabases = new Map<
  string,
  {
    db: PostgresJsDatabase<typeof testSchema>;
    client: postgres.Sql;
    connectionUri: string;
  }
>();

// Map to store initialization promises to prevent race conditions
const initPromises = new Map<
  string,
  Promise<{
    db: PostgresJsDatabase<typeof testSchema>;
    client: postgres.Sql;
    connectionUri: string;
  }>
>();

// Logger instance for database operations
const logger = getRootLogger();

/**
 * Validates that a worker ID contains only safe characters (alphanumeric only).
 * This prevents SQL injection attacks when using worker IDs in database names.
 * Security: Restricted to alphanumeric characters only, following principle of least privilege.
 * @internal Exported for testing
 */
export function validateWorkerId(workerId: string): void {
  if (!/^[a-zA-Z0-9]+$/.test(workerId)) {
    throw new Error(
      `Invalid worker ID: "${workerId}". Worker IDs must contain only alphanumeric characters (no underscores).`
    );
  }
}

/**
 * Internal function to initialize a test database for a specific worker.
 * Creates a unique database per worker and applies real application migrations.
 */
async function initializeWorkerDb(): Promise<{
  db: PostgresJsDatabase<typeof testSchema>;
  client: postgres.Sql;
  connectionUri: string;
}> {
  const container = await getPostgres();
  const workerId = process.env.VITEST_WORKER_ID ?? '0';

  // Validate worker ID to prevent SQL injection
  validateWorkerId(workerId);

  const dbName = `certquiz_test_worker_${workerId}`;

  // Get base connection parameters
  const baseUri = container.getConnectionUri();
  const baseUrl = new URL(baseUri);
  const adminConfig = {
    host: baseUrl.hostname,
    port: parseInt(baseUrl.port, 10),
    user: 'postgres',
    password: 'password',
    database: 'postgres', // Connect to postgres db for admin operations
  };

  // Create admin client
  const adminClient = postgres(adminConfig);

  try {
    // Drop database if exists (for clean slate)
    // Note: Database names cannot be parameterized in PostgreSQL, so we use unsafe after validation
    await adminClient.unsafe(`DROP DATABASE IF EXISTS ${dbName}`);

    // Create new database
    await adminClient.unsafe(`CREATE DATABASE ${dbName}`);

    // Create UUID extension
    const workerUrl = new URL(baseUri);
    workerUrl.pathname = `/${dbName}`;
    const workerUri = workerUrl.toString();

    const setupClient = postgres(workerUri);
    await setupClient`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`;
    await setupClient.end();
  } finally {
    await adminClient.end();
  }

  // Connect to the worker database
  const workerUrl = new URL(baseUri);
  workerUrl.pathname = `/${dbName}`;
  const workerUri = workerUrl.toString();

  const sqlClient = postgres(workerUri, {
    max: 10, // Smaller pool for tests
    idle_timeout: 20,
    connect_timeout: 10,
  });

  // Apply REAL application migrations
  const tempDb = baseDrizzle(sqlClient);
  const realMigrationsPath = path.join(__dirname, '../../../src/infra/db/migrations');
  await migrate(tempDb, { migrationsFolder: realMigrationsPath });

  // Apply test-specific migrations (for test_users table, etc.)
  const testMigrationsPath = path.join(__dirname, 'migrations');
  await migrate(tempDb, { migrationsFolder: testMigrationsPath });

  // Create database instance with schema
  const db = baseDrizzle(sqlClient, { schema: testSchema });

  return { db, client: sqlClient, connectionUri: workerUri };
}

/**
 * Get or create a Drizzle database instance for tests.
 * Each worker gets its own isolated database with real migrations applied.
 * Thread-safe: concurrent calls within the same worker share the same database.
 */
export async function getTestDb(): Promise<PostgresJsDatabase<typeof testSchema>> {
  const workerId = process.env.VITEST_WORKER_ID ?? '0';

  // Validate worker ID to prevent SQL injection
  validateWorkerId(workerId);

  // Check if we already have a database for this worker
  const existing = workerDatabases.get(workerId);
  if (existing) return existing.db;

  // Check if initialization is already in progress for this worker
  let initPromise = initPromises.get(workerId);
  if (!initPromise) {
    // No initialization in progress, start a new one
    initPromise = initializeWorkerDb();
    initPromises.set(workerId, initPromise);
  }

  try {
    // Wait for initialization to complete (either new or existing promise)
    const workerDb = await initPromise;
    workerDatabases.set(workerId, workerDb);
    return workerDb.db;
  } finally {
    // Clean up the promise once initialization is complete
    initPromises.delete(workerId);
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

/**
 * Clean up worker databases after tests complete.
 * This should be called in a global teardown hook.
 */
export async function cleanupWorkerDatabases(): Promise<void> {
  // Early return if no databases to clean up
  if (workerDatabases.size === 0 && initPromises.size === 0) {
    return;
  }

  // Wait for any pending initializations to complete
  if (initPromises.size > 0) {
    try {
      await Promise.all(initPromises.values());
    } catch (error) {
      // Log but don't throw - we still want to clean up what we can
      logger.warn({ error }, 'Error waiting for pending database initializations during cleanup');
    }
  }

  const container = await getPostgres();
  const baseUri = container.getConnectionUri();
  const baseUrl = new URL(baseUri);
  const adminConfig = {
    host: baseUrl.hostname,
    port: parseInt(baseUrl.port, 10),
    user: 'postgres',
    password: 'password',
    database: 'postgres',
  };

  const adminClient = postgres(adminConfig);

  try {
    // Close all worker connections in parallel
    await Promise.all(
      Array.from(workerDatabases.entries()).map(async ([workerId, workerDb]) => {
        try {
          await workerDb.client.end({ timeout: 5 });
        } catch (error) {
          logger.warn({ workerId, error }, 'Failed to close connection for worker');
        }
      })
    );

    // Drop all worker databases in parallel
    await Promise.all(
      Array.from(workerDatabases.keys()).map(async (workerId) => {
        // Validate worker ID before using in database name
        try {
          validateWorkerId(workerId);
        } catch (validationError) {
          logger.warn(
            { workerId, error: validationError },
            'Invalid worker ID, skipping database cleanup'
          );
          return;
        }

        const dbName = `certquiz_test_worker_${workerId}`;
        try {
          // Note: Database names cannot be parameterized, so we use unsafe after validation
          await adminClient.unsafe(`DROP DATABASE IF EXISTS ${dbName} WITH (FORCE)`);
        } catch (error) {
          logger.warn({ workerId, dbName, error }, 'Failed to drop database for worker');
        }
      })
    );
  } finally {
    await adminClient.end();
    workerDatabases.clear();
  }
}

/**
 * @internal Test-only helper to reset isolation state
 * Used to ensure clean state between tests
 */
export function _resetIsolationState(): void {
  workerDatabases.clear();
  initPromises.clear();
}
