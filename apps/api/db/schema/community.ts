import { index, integer, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { reportStatusEnum, reportTypeEnum } from './enums';
import { questions } from './question';
import { users } from './user';

// Badges table
export const badges = pgTable(
  'badges',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull().unique(),
    description: text('description').notNull(),
    icon: text('icon').notNull(),
    category: text('category').notNull(),
    requirementType: text('requirement_type').notNull(), // questions_solved, accuracy, streak, category_mastery
    requirementValue: integer('requirement_value').notNull(),
    requirementCategory: text('requirement_category'), // for category-specific badges
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('idx_badges_category').on(table.category)]
);

// User badges (many-to-many)
export const userBadges = pgTable(
  'user_badges',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    badgeId: uuid('badge_id')
      .notNull()
      .references(() => badges.id, { onDelete: 'cascade' }),
    unlockedAt: timestamp('unlocked_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('pk_user_badges').on(table.userId, table.badgeId),
    index('idx_user_badges_user').on(table.userId),
    index('idx_user_badges_badge').on(table.badgeId), // Added missing FK index
  ]
);

// Problem reports table
export const problemReports = pgTable(
  'problem_reports',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    questionId: uuid('question_id')
      .notNull()
      .references(() => questions.id, { onDelete: 'cascade' }),
    reporterId: uuid('reporter_id')
      .notNull()
      .references(() => users.id),
    type: reportTypeEnum('type').notNull(),
    description: text('description').notNull(),
    status: reportStatusEnum('status').notNull().default('pending'),
    adminComment: text('admin_comment'),
    reviewedById: uuid('reviewed_by_id').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    resolvedAt: timestamp('resolved_at', { withTimezone: true }),
  },
  (table) => [
    index('idx_reports_question').on(table.questionId),
    index('idx_reports_reporter').on(table.reporterId),
    index('idx_reports_status').on(table.status),
  ]
);
