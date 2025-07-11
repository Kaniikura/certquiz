/**
 * Test support utilities
 *
 * Central export point for all test helpers and utilities.
 */

// Database utilities
export * from './db';
// Migration utilities (typically used internally)
export { checkMigrations, drizzleMigrate } from './migrations';

// Runtime detection
export * from './runtime';

// Seed data helpers
export * as seeds from './seeds';
// Re-export test schema for convenience
export * from './test-schema';
export * from './tx';

// Type exports for better type safety
import type { getTestDb } from './db';
export type TestDb = Awaited<ReturnType<typeof getTestDb>>;
