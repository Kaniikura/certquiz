import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';

// Module-level variables for singleton pattern
let instance: StartedPostgreSqlContainer | undefined;
let instancePromise: Promise<StartedPostgreSqlContainer> | undefined;

/**
 * Get or create the PostgreSQL container instance.
 * Container is reused across test runs for performance.
 */
async function getInstance(): Promise<StartedPostgreSqlContainer> {
  // If we're already starting the container, return that promise
  if (instancePromise) return instancePromise;
  if (instance) return instance;

  instancePromise = (async () => {
    const container = await new PostgreSqlContainer('postgres:16-alpine')
      .withDatabase('certquiz_test')
      .withUsername('postgres')
      .withPassword('password')
      .withReuse() // Reuse container across test runs
      .start();

    // Create UUID extension and initial snapshot for fast resets
    await container.exec([
      'psql',
      '-U',
      'postgres',
      '-d',
      'certquiz_test',
      '-c',
      'CREATE EXTENSION IF NOT EXISTS "uuid-ossp"',
    ]);

    // Create a clean snapshot for fast database resets
    await createSnapshot(container, 'clean');

    instance = container;
    instancePromise = undefined; // Clear the promise reference
    return container;
  })();

  return instancePromise;
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
  getInstance,

  /**
   * Reset database to a clean state by dropping and recreating.
   * This is faster than restoring from snapshot for empty databases.
   */
  async resetToCleanState(): Promise<void> {
    const container = await getInstance();

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
  },

  /**
   * Get the connection URL for the test database.
   * This includes the dynamically mapped port.
   */
  async getConnectionUrl(): Promise<string> {
    const container = await getInstance();
    return container.getConnectionUri();
  },
};

// Export type for convenience
export type { StartedPostgreSqlContainer };
