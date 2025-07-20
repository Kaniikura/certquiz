/**
 * Database container management and URL utilities
 * Combines testcontainer management with database lifecycle operations
 */

import { randomUUID } from 'node:crypto';
import postgres from 'postgres';

/**
 * URL manipulation utilities for database connections
 */

/**
 * Safely builds a database connection URL with a new database name
 * @param baseUrl - Original database connection URL
 * @param dbName - New database name to use
 * @returns Modified connection URL with new database name
 */
export function buildDatabaseUrl(baseUrl: string, dbName: string): string {
  try {
    const url = new URL(baseUrl);
    url.pathname = `/${dbName}`;
    return url.toString();
  } catch (error) {
    throw new Error(`Invalid database URL: ${baseUrl}. Error: ${error}`);
  }
}

/**
 * Extracts the database name from a connection URL
 * @param connectionUrl - Database connection URL
 * @returns Database name or null if not found
 */
export function extractDatabaseName(connectionUrl: string): string | null {
  try {
    const url = new URL(connectionUrl);
    const dbName = url.pathname.slice(1); // Remove leading slash
    return dbName || null;
  } catch {
    return null;
  }
}

/**
 * Validates that a URL appears to be a valid PostgreSQL connection string
 * @param url - URL to validate
 * @returns true if URL looks valid
 */
export function isValidPostgresUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'postgresql:' || parsed.protocol === 'postgres:';
  } catch {
    return false;
  }
}

/**
 * Container and database management
 */

/**
 * Options for creating a test database
 */
export interface TestDatabaseOptions {
  prefix?: string;
  timeout?: number;
}

/**
 * Test database instance with cleanup capabilities
 */
export interface TestDatabase {
  name: string;
  connectionUrl: string;
  cleanup: () => Promise<void>;
}

/**
 * Creates a unique test database for migration testing
 * Uses crypto.randomUUID() instead of Date.now() to prevent collisions
 *
 * @param container - PostgreSQL container instance
 * @param options - Database creation options
 * @returns Test database instance with cleanup function
 */
export async function createTestDatabase(
  container: { getConnectionUri(): string },
  options: TestDatabaseOptions = {}
): Promise<TestDatabase> {
  const { prefix = 'test_migrations', timeout = 30000 } = options;

  // Use UUID instead of timestamp to prevent parallel CI collisions
  const dbName = `${prefix}_${randomUUID().replace(/-/g, '_')}`;
  const baseUrl = container.getConnectionUri();

  // Create admin client with limited connection pool
  const adminClient = postgres(baseUrl, {
    max: 1,
    idle_timeout: timeout / 1000,
    connect_timeout: timeout / 1000,
  });

  try {
    // Create the test database
    await adminClient.unsafe(`CREATE DATABASE "${dbName}"`);
    const connectionUrl = buildDatabaseUrl(baseUrl, dbName);

    return {
      name: dbName,
      connectionUrl,
      cleanup: async () => {
        await cleanupTestDatabase(container, dbName);
      },
    };
  } catch (error) {
    throw new Error(`Failed to create test database "${dbName}": ${error}`);
  } finally {
    await adminClient.end();
  }
}

/**
 * Cleans up a test database by terminating connections and dropping it
 *
 * @param container - PostgreSQL container instance
 * @param dbName - Database name to clean up
 */
export async function cleanupTestDatabase(
  container: { getConnectionUri(): string },
  dbName: string
): Promise<void> {
  const baseUrl = container.getConnectionUri();
  const adminClient = postgres(baseUrl, { max: 1 });

  try {
    // Terminate all connections to the database
    await adminClient`
      SELECT pg_terminate_backend(pg_stat_activity.pid)
      FROM pg_stat_activity
      WHERE pg_stat_activity.datname = ${dbName}
        AND pid <> pg_backend_pid()
    `;

    // Drop the database
    await adminClient.unsafe(`DROP DATABASE IF EXISTS "${dbName}"`);
  } catch {
    // Silently ignore cleanup errors to avoid test noise
    // In real scenarios, this would be logged to a proper logger
  } finally {
    await adminClient.end();
  }
}

/**
 * Pool tracking for proper cleanup
 */
const activePools = new Set<postgres.Sql>();

/**
 * Creates a tracked postgres client that will be cleaned up
 *
 * @param connectionUrl - Database connection URL
 * @param options - Postgres client options
 * @returns Tracked postgres client
 */
export function createTrackedClient(
  connectionUrl: string,
  options: postgres.Options<Record<string, never>> = {}
): postgres.Sql {
  const client = postgres(connectionUrl, { max: 1, ...options });
  activePools.add(client);
  return client;
}

/**
 * Closes all tracked postgres clients
 * Call this in afterAll hooks to prevent resource leaks
 */
export async function closeAllTrackedClients(): Promise<void> {
  const closePromises = Array.from(activePools).map(async (client) => {
    try {
      await client.end();
    } catch {
      // Silently ignore client close errors
    }
  });

  await Promise.all(closePromises);
  activePools.clear();
}
