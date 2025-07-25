// System tables schema

import { eq } from 'drizzle-orm';
import { index, integer, jsonb, pgTable, serial, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { webhookStatusEnum } from './enums';

// Migration tracking (used by Drizzle)
export const drizzleMigrations = pgTable('drizzle_migrations', {
  id: serial('id').primaryKey(),
  hash: text('hash').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// Webhook events for external integrations
export const webhookEvent = pgTable(
  'webhook_event',
  {
    eventId: uuid('event_id').primaryKey().defaultRandom(),
    eventType: text('event_type').notNull(),
    payload: jsonb('payload').notNull(),
    status: webhookStatusEnum('status').notNull().default('pending'),
    retryCount: integer('retry_count').notNull().default(0),
    maxRetries: integer('max_retries').notNull().default(3),
    scheduledAt: timestamp('scheduled_at', { withTimezone: true }).notNull().defaultNow(),
    processedAt: timestamp('processed_at', { withTimezone: true }),
    errorMessage: text('error_message'),
  },
  (table) => [
    index('ix_webhook_status_scheduled').on(table.status, table.scheduledAt),
    index('ix_webhook_type').on(table.eventType),
    index('ix_webhook_retry').on(table.retryCount).where(eq(table.status, 'failed')),
  ]
);

// Test migration table for rollback convention testing
export const testMigration = pgTable('test_migration', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
