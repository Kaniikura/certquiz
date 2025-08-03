// Auth bounded context schema

import { userRoleEnum } from '@api/features/user/infrastructure/drizzle/schema/enums';
import { boolean, index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

// Local user table synchronized with identity provider
export const authUser = pgTable(
  'auth_user',
  {
    userId: uuid('user_id').primaryKey().defaultRandom(),
    email: text('email').notNull().unique(),
    username: text('username').notNull().unique(),
    identityProviderId: text('identity_provider_id').unique(),
    role: userRoleEnum('role').notNull().default('user'),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('ix_user_role_active').on(table.role, table.isActive)]
);

// Type exports for row inference
export type AuthUserRow = typeof authUser.$inferSelect;
