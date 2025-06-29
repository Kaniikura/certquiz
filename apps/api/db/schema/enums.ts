import { pgEnum } from 'drizzle-orm/pg-core';

// User-related enums
export const userRoleEnum = pgEnum('user_role', ['guest', 'user', 'premium', 'admin']);
export const subscriptionPlanEnum = pgEnum('subscription_plan', ['free', 'premium']);
export const subscriptionStatusEnum = pgEnum('subscription_status', [
  'active',
  'cancelled',
  'expired',
]);

// Question-related enums
export const questionTypeEnum = pgEnum('question_type', ['single', 'multiple']);
export const questionStatusEnum = pgEnum('question_status', ['active', 'pending', 'archived']);

// Community-related enums
export const reportTypeEnum = pgEnum('report_type', ['error', 'unclear', 'outdated']);
export const reportStatusEnum = pgEnum('report_status', ['pending', 'accepted', 'rejected']);
