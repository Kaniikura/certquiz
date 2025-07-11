import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { drizzleMigrate } from '../support/migrations';

// Module-level variables for singleton pattern
let instance: StartedPostgreSqlContainer | undefined;
let instancePromise: Promise<StartedPostgreSqlContainer> | undefined;

// Mutex for database reset operations to prevent race conditions
let resetMutex: Promise<void> = Promise.resolve();

/**
 * Simple mutex implementation for serializing database operations
 */
async function withMutex<T>(operation: () => Promise<T>): Promise<T> {
  // Wait for any ongoing operation
  await resetMutex;

  // Create a new promise for this operation
  let resolve: () => void;
  resetMutex = new Promise<void>((r) => {
    resolve = r;
  });

  try {
    // Execute the operation
    const result = await operation();
    return result;
  } finally {
    // Release the mutex
    resolve?.();
  }
}

/**
 * Get or create the PostgreSQL container instance.
 * Container is reused across test runs for performance.
 * Automatically runs Drizzle migrations on first start.
 */
export async function getPostgres(): Promise<StartedPostgreSqlContainer> {
  // If instance exists, return it
  if (instance) return instance;
  // If we're already starting the container, return that promise
  if (instancePromise) return instancePromise;

  instancePromise = (async () => {
    const container = await new PostgreSqlContainer('postgres:16-alpine')
      .withDatabase('certquiz_test')
      .withUsername('postgres')
      .withPassword('password')
      .withReuse() // Reuse container across test runs
      .start();

    // Create UUID extension
    try {
      await container.exec([
        'psql',
        '-U',
        'postgres',
        '-d',
        'certquiz_test',
        '-c',
        'CREATE EXTENSION IF NOT EXISTS "uuid-ossp"',
      ]);
    } catch (error) {
      throw new Error(
        `Failed to create UUID extension. Is Docker running? Error: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
      );
    }

    // Run Drizzle migrations
    await drizzleMigrate(container);

    // Create a clean snapshot after migrations for fast resets
    await createSnapshot(container, 'clean');

    instance = container;
    return container;
  })();

  return instancePromise;
}

/**
 * Get or create the PostgreSQL container instance.
 * @deprecated Use getPostgres() instead. Will be removed after 2025-09-01.
 */
/* biome-ignore lint/correctness/noUnusedVariables: kept for backward compatibility */
async function getInstance(): Promise<StartedPostgreSqlContainer> {
  return getPostgres();
}

/**
 * Create a named snapshot of the current database state.
 * This uses pg_dump internally for fast backup/restore.
 */
async function createSnapshot(container: StartedPostgreSqlContainer, name: string): Promise<void> {
  // Use pg_dump to create a snapshot
  const dumpResult = await container.exec([
    'pg_dump',
    '-U',
    'postgres',
    '-d',
    'certquiz_test',
    '-f',
    `/tmp/snapshot_${name}.sql`,
  ]);

  if (dumpResult.exitCode !== 0) {
    throw new Error(`Failed to create snapshot: ${dumpResult.stderr}`);
  }
}

/**
 * PostgreSQL test container singleton.
 * Provides fast database resets for test isolation.
 */
export const PostgresSingleton = {
  getInstance: getPostgres, // Use new function

  /**
   * Reset database to a clean state by dropping and recreating.
   * This is faster than restoring from snapshot for empty databases.
   * Operations are serialized using a mutex to prevent race conditions.
   */
  async resetToCleanState(): Promise<void> {
    return withMutex(async () => {
      const container = await getPostgres();

      // First, check if there are any connections to terminate
      const { output } = await container.exec([
        'psql',
        '-U',
        'postgres',
        '-d',
        'postgres',
        '-t',
        '-c',
        "SELECT COUNT(*) FROM pg_stat_activity WHERE datname = 'certquiz_test' AND pid <> pg_backend_pid()",
      ]);

      const connectionCount = parseInt(output.trim(), 10);

      // Only terminate connections if they exist
      if (connectionCount > 0) {
        await container.exec([
          'psql',
          '-U',
          'postgres',
          '-d',
          'postgres',
          '-c',
          "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = 'certquiz_test' AND pid <> pg_backend_pid()",
        ]);
      }

      // Drop and recreate the database for a truly clean state
      await container.exec([
        'psql',
        '-U',
        'postgres',
        '-d',
        'postgres', // Connect to postgres db to drop certquiz_test
        '-c',
        'DROP DATABASE IF EXISTS certquiz_test',
      ]);

      await container.exec([
        'psql',
        '-U',
        'postgres',
        '-d',
        'postgres',
        '-c',
        'CREATE DATABASE certquiz_test',
      ]);

      // Recreate UUID extension
      await container.exec([
        'psql',
        '-U',
        'postgres',
        '-d',
        'certquiz_test',
        '-c',
        'CREATE EXTENSION IF NOT EXISTS "uuid-ossp"',
      ]);

      // Re-run migrations to restore schema
      await drizzleMigrate(container);
    });
  },

  /**
   * Get the connection URL for the test database.
   * This includes the dynamically mapped port.
   */
  async getConnectionUrl(): Promise<string> {
    const container = await getPostgres();
    return container.getConnectionUri();
  },

  /**
   * Restore database from snapshot.
   * Useful for integration tests that need specific database states.
   * Operations are serialized using a mutex to prevent race conditions.
   */
  async restoreSnapshot(name: string): Promise<void> {
    return withMutex(async () => {
      const container = await getPostgres();

      // Drop and recreate database
      await container.exec([
        'psql',
        '-U',
        'postgres',
        '-d',
        'postgres',
        '-c',
        'DROP DATABASE IF EXISTS certquiz_test',
      ]);

      await container.exec([
        'psql',
        '-U',
        'postgres',
        '-d',
        'postgres',
        '-c',
        'CREATE DATABASE certquiz_test',
      ]);

      // Restore from snapshot
      const restoreResult = await container.exec([
        'psql',
        '-U',
        'postgres',
        '-d',
        'certquiz_test',
        '-f',
        `/tmp/snapshot_${name}.sql`,
      ]);

      if (restoreResult.exitCode !== 0) {
        throw new Error(`Failed to restore snapshot: ${restoreResult.stderr}`);
      }
    });
  },
};

// Export type for convenience
export type { StartedPostgreSqlContainer };
