// Question bookmarks schema

import { authUser } from '@api/features/auth/infrastructure/drizzle/schema';
import { index, pgTable, primaryKey, timestamp, uuid } from 'drizzle-orm/pg-core';
import { question } from './question';

// Bookmarks for user question management
export const bookmarks = pgTable(
  'bookmarks',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => authUser.userId, { onDelete: 'cascade' }),
    questionId: uuid('question_id')
      .notNull()
      .references(() => question.questionId, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.questionId] }),
    index('ix_bookmarks_user').on(table.userId),
  ]
);
