// User bounded context schema
import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  decimal,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { subscriptionPlanEnum, subscriptionStatusEnum, userRoleEnum } from './enums';

// Local user table synchronized with identity provider
export const authUser = pgTable(
  'auth_user',
  {
    userId: uuid('user_id').primaryKey(),
    email: text('email').notNull().unique(),
    username: text('username').notNull().unique(),
    identityProviderId: text('identity_provider_id').unique(),
    role: userRoleEnum('role').notNull().default('user'),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('ix_user_email').on(table.email),
    index('ix_user_identity_provider').on(table.identityProviderId),
    index('ix_user_role_active').on(table.role, table.isActive),
  ]
);

// Type exports for domain mapping
export type AuthUserRow = typeof authUser.$inferSelect;
export type NewAuthUserRow = typeof authUser.$inferInsert;

// User progress tracking (separate from auth for performance)
export const userProgress = pgTable(
  'user_progress',
  {
    userId: uuid('user_id')
      .primaryKey()
      .references(() => authUser.userId, { onDelete: 'cascade' }),
    level: integer('level').notNull().default(1),
    experience: integer('experience').notNull().default(0),
    totalQuestions: integer('total_questions').notNull().default(0),
    correctAnswers: integer('correct_answers').notNull().default(0),
    accuracy: decimal('accuracy', { precision: 5, scale: 2 }).notNull().default('0.00'),
    studyTimeMinutes: integer('study_time_minutes').notNull().default(0),
    currentStreak: integer('current_streak').notNull().default(0),
    lastStudyDate: timestamp('last_study_date', { withTimezone: true }),

    // JSONB for flexible category-specific stats
    categoryStats: jsonb('category_stats').notNull().default({ version: 1 }),

    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // Performance indexes for leaderboards and user lookup
    index('ix_progress_experience_desc').on(sql`${table.experience} DESC`),
    index('ix_progress_last_study').on(sql`${table.lastStudyDate} DESC NULLS LAST`),

    // Performance index for user progress dashboard queries
    index('ix_progress_user_stats').on(table.userId, table.updatedAt),

    // GIN index for category stats JSONB queries
    index('ix_progress_category_stats_gin').using('gin', table.categoryStats),

    // Check constraints for data integrity
    check('ck_progress_accuracy_range', sql`${table.accuracy} >= 0 AND ${table.accuracy} <= 100`),
    check(
      'ck_progress_non_negative_values',
      sql`
      ${table.level} >= 1 AND 
      ${table.experience} >= 0 AND 
      ${table.totalQuestions} >= 0 AND 
      ${table.correctAnswers} >= 0 AND
      ${table.studyTimeMinutes} >= 0 AND 
      ${table.currentStreak} >= 0
    `
    ),
    check(
      'ck_correct_answers_not_exceed_total',
      sql`${table.correctAnswers} <= ${table.totalQuestions}`
    ),
  ]
);

export type UserProgressRow = typeof userProgress.$inferSelect;
export type NewUserProgressRow = typeof userProgress.$inferInsert;

// Subscriptions (for future premium features)
export const subscriptions = pgTable(
  'subscriptions',
  {
    userId: uuid('user_id')
      .primaryKey()
      .references(() => authUser.userId, { onDelete: 'cascade' }),
    plan: subscriptionPlanEnum('plan').notNull().default('free'),
    status: subscriptionStatusEnum('status').notNull().default('active'),
    buyMeACoffeeEmail: text('buy_me_a_coffee_email'),
    startDate: timestamp('start_date', { withTimezone: true }).notNull().defaultNow(),
    endDate: timestamp('end_date', { withTimezone: true }),
    autoRenew: boolean('auto_renew').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('ix_subscriptions_bmac_email').on(table.buyMeACoffeeEmail),
    index('ix_subscriptions_status').on(table.status),
    uniqueIndex('unq_bmac_email').on(table.buyMeACoffeeEmail),
  ]
);

export type SubscriptionRow = typeof subscriptions.$inferSelect;
export type NewSubscriptionRow = typeof subscriptions.$inferInsert;
