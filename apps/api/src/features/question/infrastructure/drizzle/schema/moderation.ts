import { authUser } from '@api/features/auth/infrastructure/drizzle/schema/authUser';
import { index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { questionStatusEnum } from './enums';
import { question } from './question';

// Moderation logs table for tracking all moderation actions
export const moderationLogs = pgTable(
  'moderation_logs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    questionId: uuid('question_id')
      .notNull()
      .references(() => question.questionId, { onDelete: 'cascade' }),
    action: text('action').notNull(), // 'approve', 'reject', 'request_changes'
    moderatedBy: uuid('moderated_by')
      .notNull()
      .references(() => authUser.userId),
    moderatedAt: timestamp('moderated_at', { withTimezone: true }).notNull().defaultNow(),
    feedback: text('feedback'),
    previousStatus: questionStatusEnum('previous_status').notNull(),
    newStatus: questionStatusEnum('new_status').notNull(),
  },
  (table) => [
    // Performance indexes for common queries
    index('ix_moderation_logs_question').on(table.questionId, table.moderatedAt),
    index('ix_moderation_logs_moderator').on(table.moderatedBy, table.moderatedAt),
    index('ix_moderation_logs_action').on(table.action, table.moderatedAt),
  ]
);

export type ModerationLogRow = typeof moderationLogs.$inferSelect;
