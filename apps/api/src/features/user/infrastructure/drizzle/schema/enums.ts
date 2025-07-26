// User feature specific enums
import { pgEnum } from 'drizzle-orm/pg-core';

// User related enums
const userRoleValues = ['guest', 'user', 'premium', 'admin'] as const;
export const userRoleEnum = pgEnum('user_role', userRoleValues);

const subscriptionPlanValues = ['free', 'premium'] as const;
export const subscriptionPlanEnum = pgEnum('subscription_plan', subscriptionPlanValues);

const subscriptionStatusValues = ['active', 'cancelled', 'expired'] as const;
export const subscriptionStatusEnum = pgEnum('subscription_status', subscriptionStatusValues);

// Strongly-typed unions for type safety
export type UserRoleValue = (typeof userRoleValues)[number];
export type SubscriptionPlanValue = (typeof subscriptionPlanValues)[number];
export type SubscriptionStatusValue = (typeof subscriptionStatusValues)[number];
