import { randomUUID } from 'node:crypto';
import postgres from 'postgres';

/**
 * Creates a fresh database for migration testing
 * Based on O3 recommendation for reliable migration tests
 *
 * @param rootConnectionUrl - Connection URL to PostgreSQL server (not specific database)
 * @returns Connection URL to the newly created database
 */
export async function freshDbUrl(rootConnectionUrl: string): Promise<string> {
  // Generate unique database name
  const dbName = `t_${randomUUID().replace(/-/g, '').substring(0, 16)}`;

  // Extract base URL without database name
  const url = new URL(rootConnectionUrl);
  const baseUrl = `${url.protocol}//${url.username}:${url.password}@${url.host}`;

  // Connect to default database to create new one
  const admin = postgres(`${baseUrl}/postgres`, { max: 1 });

  try {
    // Use unsafe() for database name as it needs to be an identifier, not a parameter
    await admin.unsafe(`CREATE DATABASE "${dbName}"`);
    return `${baseUrl}/${dbName}`;
  } finally {
    await admin.end();
  }
}

/**
 * Drops a database created with freshDbUrl
 *
 * @param rootConnectionUrl - Connection URL to PostgreSQL server
 * @param targetDbUrl - Connection URL to the database to drop
 */
export async function dropFreshDb(rootConnectionUrl: string, targetDbUrl: string): Promise<void> {
  const targetUrl = new URL(targetDbUrl);
  const dbName = targetUrl.pathname.substring(1); // Remove leading '/'

  if (!dbName.startsWith('t_')) {
    throw new Error(`Refusing to drop non-test database: ${dbName}`);
  }

  // Extract base URL
  const url = new URL(rootConnectionUrl);
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
