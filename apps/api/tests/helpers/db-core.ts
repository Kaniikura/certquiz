import { randomUUID } from 'node:crypto';
import type { Sql } from 'postgres';
import postgres from 'postgres';
import type { StartedPostgreSqlContainer } from '../containers/postgres';
import { drizzleMigrate } from './db-migrations';

/**
 * Track postgres clients for proper cleanup
 */
const trackedClients = new Set<Sql>();

/**
 * Track a postgres client for cleanup
 */
export function trackClient(client: Sql): void {
  trackedClients.add(client);
}

/**
 * Remove a client from tracking (when manually closed)
 */
export function untrackClient(client: Sql): void {
  trackedClients.delete(client);
}

/**
 * Options for creating a test database
 */
interface TestDatabaseOptions {
  /** Either a root connection string or a Testcontainers instance */
  root: string | StartedPostgreSqlContainer;
  /** Run migrations automatically? (default = true) */
  migrate?: boolean;
}

/**
 * Creates a brand-new temporary database for a test suite.
 *
 * By default the database is migrated to the latest version.
 * Pass `{ migrate: false }` for migration-tests that need a blank DB.
 *
 * Returns the database URL and a `drop()` helper you MUST call in afterAll().
 *
 * @example
 * ```typescript
 * // Normal tests - with migrations
 * beforeAll(async () => {
 *   ({ url, drop } = await createTestDatabase({ root }));
 * });
 * afterAll(async () => await drop());
 *
 * // Migration tests - empty DB
 * beforeAll(async () => {
 *   ({ url, drop } = await createTestDatabase({ root, migrate: false }));
 * });
 * ```
 */
export async function createTestDatabase({
  root,
  migrate = true,
}: TestDatabaseOptions): Promise<{ url: string; drop: () => Promise<void> }> {
  // 1. Build a DB name that is unique to this suite
  const dbName = `t_${randomUUID().replace(/-/g, '').substring(0, 16)}`;

  // 2. Resolve root → string (container or plain URL)
  const rootUrl = typeof root === 'string' ? root : root.getConnectionUri();

  // 3. Actually create the database
  await _createDatabase(rootUrl, dbName);

  // 4. Build the connection URL for the new database
  const url = _buildDatabaseUrl(rootUrl, dbName);

  // 5. Run migrations when requested – bail out CLEANLY on error
  if (migrate) {
    try {
      await drizzleMigrate(url);
    } catch (error) {
      await _dropDatabase(rootUrl, dbName); // leave no junk behind
      throw error; // fail the test early
    }
  }

  // 6. Return URL + drop helper
  return {
    url,
    drop: () => _dropDatabase(rootUrl, dbName),
  };
}

/**
 * @internal Create a new database with the given name
 */
async function _createDatabase(rootUrl: string, dbName: string): Promise<void> {
  // Extract base URL without database name
  const url = new URL(rootUrl);
  const baseUrl = `${url.protocol}//${url.username}:${url.password}@${url.host}`;

  // Connect to default database to create new one
  const admin = postgres(`${baseUrl}/postgres`, { max: 1 });

  try {
    // Use unsafe() for database name as it needs to be an identifier, not a parameter
    await admin.unsafe(`CREATE DATABASE "${dbName}"`);
  } finally {
    await admin.end();
  }
}

/**
 * @internal Drop a database with the given name
 */
async function _dropDatabase(rootUrl: string, dbName: string): Promise<void> {
  if (!dbName.startsWith('t_')) {
    throw new Error(`Refusing to drop non-test database: ${dbName}`);
  }

  // Extract base URL
  const url = new URL(rootUrl);
  const baseUrl = `${url.protocol}//${url.username}:${url.password}@${url.host}`;

  const admin = postgres(`${baseUrl}/postgres`, { max: 1 });

  try {
    // Terminate any active connections to the target database
    await admin`
      SELECT pg_terminate_backend(pid)
      FROM pg_stat_activity
      WHERE datname = ${dbName} AND pid <> pg_backend_pid()
    `;

    // Drop the database using unsafe() for identifier
    await admin.unsafe(`DROP DATABASE IF EXISTS "${dbName}"`);
  } finally {
    await admin.end();
  }
}

/**
 * @internal Build database URL from root URL and database name
 */
function _buildDatabaseUrl(rootUrl: string, dbName: string): string {
  const url = new URL(rootUrl);
  const baseUrl = `${url.protocol}//${url.username}:${url.password}@${url.host}`;
  return `${baseUrl}/${dbName}`;
}

/**
 * Close all tracked database clients
 */
export async function closeAllTrackedClients(): Promise<void> {
  const clients = Array.from(trackedClients);
  trackedClients.clear();

  await Promise.allSettled(clients.map((client) => client.end()));
}
