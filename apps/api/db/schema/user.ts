import {
  boolean,
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

// Users table
export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    email: text('email').notNull().unique(),
    username: text('username').notNull().unique(),
    keycloakId: text('keycloak_id').unique(),
    role: userRoleEnum('role').notNull().default('user'),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_users_email').on(table.email),
    index('idx_users_keycloak').on(table.keycloakId),
  ]
);

// User progress table
export const userProgress = pgTable('user_progress', {
  userId: uuid('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  level: integer('level').notNull().default(1),
  experience: integer('experience').notNull().default(0),
  totalQuestions: integer('total_questions').notNull().default(0),
  correctAnswers: integer('correct_answers').notNull().default(0),
  accuracy: decimal('accuracy', { precision: 5, scale: 2 }).notNull().default('0.00'),
  studyTime: integer('study_time').notNull().default(0), // in minutes
  streak: integer('streak').notNull().default(0),
  lastStudyDate: timestamp('last_study_date', { withTimezone: true }),
  categoryStats: jsonb('category_stats').notNull().default({ version: 1 }), // Added version field for future migrations
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// Subscriptions table
export const subscriptions = pgTable(
  'subscriptions',
  {
    userId: uuid('user_id')
      .primaryKey()
      .references(() => users.id),
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
    index('idx_subscriptions_bmac_email').on(table.buyMeACoffeeEmail),
    index('idx_subscriptions_status').on(table.status),
    // Unique constraint for Buy Me a Coffee email
    uniqueIndex('unq_bmac_email').on(table.buyMeACoffeeEmail),
  ]
);
