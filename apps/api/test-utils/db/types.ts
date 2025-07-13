/**
 * Central type definitions for test database utilities
 */

import type { ExtractTablesWithRelations } from 'drizzle-orm';
import type { PostgresJsDatabase, PostgresJsTransaction } from 'drizzle-orm/postgres-js';
import type { testSchema } from './schema';

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
