/**
 * Database container management and URL utilities
 * Combines testcontainer management with database lifecycle operations
 */

import type postgres from 'postgres';

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
 * Pool tracking for proper cleanup
 */
const activePools = new Set<postgres.Sql>();

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
