// PostgreSQL enums for type safety
import { pgEnum } from 'drizzle-orm/pg-core';

// User related enums
export const userRoleEnum = pgEnum('user_role', ['guest', 'user', 'premium', 'admin']);
export const subscriptionPlanEnum = pgEnum('subscription_plan', ['free', 'premium']);
export const subscriptionStatusEnum = pgEnum('subscription_status', [
  'active',
  'cancelled',
  'expired',
]);

// Quiz related enums
export const questionTypeEnum = pgEnum('question_type', ['single', 'multiple']);
export const questionStatusEnum = pgEnum('question_status', [
  'draft',
  'active',
  'inactive',
  'archived',
]);
export const quizStateEnum = pgEnum('quiz_state', ['IN_PROGRESS', 'COMPLETED', 'EXPIRED']);

// Exam related enums
export const examTypeEnum = pgEnum('exam_type', [
  'CCNA',
  'CCNP_ENCOR',
  'CCNP_ENARSI',
  'SECURITY_PLUS',
]);
export const difficultyEnum = pgEnum('difficulty', [
  'Beginner',
  'Intermediate',
  'Advanced',
  'Expert',
  'Mixed',
]);

// Webhook status enum
export const webhookStatusEnum = pgEnum('webhook_status', [
  'pending',
  'processing',
  'completed',
  'failed',
]);
