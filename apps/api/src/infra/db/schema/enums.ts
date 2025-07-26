// PostgreSQL enums for system-wide/cross-cutting concerns
import { pgEnum } from 'drizzle-orm/pg-core';

// Webhook status enum (system-wide)
export const webhookStatusEnum = pgEnum('webhook_status', [
  'pending',
  'processing',
  'completed',
  'failed',
]);
