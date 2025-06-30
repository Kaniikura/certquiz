import { index, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

// Webhook events table (for payment processing)
export const webhookEvents = pgTable(
  'webhook_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    eventType: text('event_type').notNull(), // 'subscription.created', 'subscription.cancelled', etc.
    externalEventId: text('external_event_id').unique(), // External service event ID for deduplication
    payload: jsonb('payload').notNull(), // Raw webhook payload
    processedAt: timestamp('processed_at', { withTimezone: true }), // NULL if not processed yet
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_webhook_events_type').on(table.eventType),
    index('idx_webhook_events_processed').on(table.processedAt), // For finding unprocessed events
    // externalEventId already has unique index
  ]
);
