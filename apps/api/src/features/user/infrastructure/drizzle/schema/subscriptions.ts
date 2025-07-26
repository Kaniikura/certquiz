// User subscriptions schema

import { authUser } from '@api/features/auth/infrastructure/drizzle/schema';
import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { subscriptionPlanEnum, subscriptionStatusEnum } from './enums';

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
    index('ix_subscriptions_status').on(table.status),
    uniqueIndex('unq_bmac_email').on(table.buyMeACoffeeEmail),

    // Check constraint to ensure endDate is not before startDate
    check(
      'ck_subscription_date_range',
      sql`${table.endDate} IS NULL OR ${table.endDate} >= ${table.startDate}`
    ),
  ]
);
