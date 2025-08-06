// User feature specific enums

import { UserRole } from '@api/features/auth/domain/value-objects/UserRole';
import { pgEnum } from 'drizzle-orm/pg-core';

// User related enums
export const userRoleEnum = pgEnum('user_role', UserRole.USER_ROLE_TUPLE);

const subscriptionPlanValues = ['free', 'premium'] as const;
export const subscriptionPlanEnum = pgEnum('subscription_plan', subscriptionPlanValues);

const subscriptionStatusValues = ['active', 'cancelled', 'expired'] as const;
export const subscriptionStatusEnum = pgEnum('subscription_status', subscriptionStatusValues);
