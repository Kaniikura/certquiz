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
 * Create a test database wrapper
 */
export function createTestDb(client: Sql): PostgresJsDatabase<Schema> {
  return drizzle(client, { schema: testSchema });
}
