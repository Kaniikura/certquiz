import { pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

// Test table to verify Drizzle setup
export const testTable = pgTable('test_table', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});
