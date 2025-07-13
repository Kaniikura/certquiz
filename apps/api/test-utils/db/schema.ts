/**
 * Test-only schema definitions.
 * These tables exist only in test environments and are never deployed to production.
 * This file serves as the single source of truth for test table definitions.
 */

import { boolean, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

// Test table for migration testing
export const testMigration = pgTable('test_migration', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// Test table for infrastructure testing
export const testUsers = pgTable('test_users', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// Export as schema object for Drizzle
export const testSchema = {
  testMigration,
  testUsers,
};

// Type exports
export type TestUser = typeof testUsers.$inferSelect;
export type NewTestUser = typeof testUsers.$inferInsert;
