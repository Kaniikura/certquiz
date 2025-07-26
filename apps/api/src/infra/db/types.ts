/**
 * Common database types used across production and test environments
 * Extracted to maintain separation of concerns between different database clients
 */

import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import type * as schema from './schema';

// Core database types
export type DB = PostgresJsDatabase<typeof schema>;
