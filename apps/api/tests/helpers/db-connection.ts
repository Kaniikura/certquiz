/**
 * Test database connection utilities
 */

import type { ExtractTablesWithRelations } from 'drizzle-orm';
import type { PostgresJsDatabase, PostgresJsTransaction } from 'drizzle-orm/postgres-js';
import { drizzle } from 'drizzle-orm/postgres-js';
import type { Sql } from 'postgres';
import { testSchema } from './db-schema';

// Schema types
type Schema = typeof testSchema;
type Relations = ExtractTablesWithRelations<Schema>;

/**
 * Union type for database operations that accept both database instances and transactions.
 * This allows maximum flexibility for test utilities.
 */
export type TestDb = PostgresJsDatabase<Schema> | PostgresJsTransaction<Schema, Relations>;

/**
 * Specific transaction type for operations that require transaction context.
 */
export type TestTransaction = PostgresJsTransaction<Schema, Relations>;

/**
 * Create a test database wrapper
 */
export function createTestDb(client: Sql): PostgresJsDatabase<Schema> {
  return drizzle(client, { schema: testSchema });
}

/**
 * Validate worker ID format
 */
export function validateWorkerId(workerId: string): void {
  if (!workerId || !/^[a-zA-Z0-9_]+$/.test(workerId)) {
    throw new Error(
      `Invalid worker ID: ${workerId}. Must contain only alphanumeric characters and underscores.`
    );
  }
}

/**
 * Quote identifier for SQL
 */
export function quoteIdentifier(identifier: string): string {
  return `"${identifier.replace(/"/g, '""')}"`;
}

/**
 * Get worker database name
 */
export function getWorkerDatabaseName(workerId: string): { raw: string; quoted: string } {
  validateWorkerId(workerId);
  const raw = `test_${workerId}`;
  return { raw, quoted: quoteIdentifier(raw) };
}

/**
 * Execute function with test database
 */
export async function withTestDb<T>(_fn: (db: TestDb) => Promise<T>): Promise<T> {
  // This would be implemented with actual database connection logic
  throw new Error('Not implemented - use createTestDb directly');
}
