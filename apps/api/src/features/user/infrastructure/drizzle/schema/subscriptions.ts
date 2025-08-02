import { authUser } from '@api/features/auth/infrastructure/drizzle/schema/authUser';
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

    /**
     * Business Rule: Subscription Date Range Validation
     *
     * This CHECK constraint enforces that subscription end dates must be either:
     * - NULL: Representing an indefinite/lifetime subscription with no expiration
     * - Greater than or equal to the start date: Ensuring logical consistency in subscription periods
     *
     * This prevents data integrity issues where a subscription would end before it begins,
     * which could cause billing errors, access control problems, or reporting inconsistencies.
     *
     * Examples:
     * - Valid: startDate='2025-01-01', endDate=NULL (indefinite subscription)
     * - Valid: startDate='2025-01-01', endDate='2025-12-31' (annual subscription)
     * - Invalid: startDate='2025-01-01', endDate='2024-12-31' (ends before it starts)
     *
     * Reference: See Business Requirements Document (BRD) Section 7.4 Subscription Rules (BR-SB)
     * for detailed business rules on subscription date validation and grace period handling.
     */
    check(
      'ck_subscription_date_range',
      sql`${table.endDate} IS NULL OR ${table.endDate} >= ${table.startDate}`
    ),
  ]
);
