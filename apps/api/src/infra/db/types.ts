/**
 * Common database types used across production and test environments
 * Extracted to maintain separation of concerns between different database clients
 */

import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import type * as schema from './schema';

// Core database types
export type DB = PostgresJsDatabase<typeof schema>;
export type Tx = Parameters<DB['transaction']>[0] extends (tx: infer T) => unknown ? T : never;

// Queryable interface for repositories to work with both DB and Tx
export type Queryable = Pick<DB, 'select' | 'insert' | 'update' | 'delete' | 'execute' | 'query'>;

// Re-export for backward compatibility
export type DrizzleDb = DB;
