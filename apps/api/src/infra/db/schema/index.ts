// Barrel export for all schema tables - organized by bounded context
// This file is used by migrations to access all tables

export type { AuthUserRow } from '@api/features/auth/infrastructure/drizzle/schema';
// Re-export feature schemas for migrations
export { authUser, userRoleEnum } from '@api/features/auth/infrastructure/drizzle/schema';
export type {
  QuestionRow,
  QuestionVersionRow,
} from '@api/features/question/infrastructure/drizzle/schema';
export {
  bookmarks,
  difficultyEnum,
  question,
  questionStatusEnum,
  questionTypeEnum,
  questionVersion,
} from '@api/features/question/infrastructure/drizzle/schema';
export type { QuizSessionEventRow } from '@api/features/quiz/infrastructure/drizzle/schema';
export {
  quizSessionEvent,
  quizSessionSnapshot,
  quizStateEnum,
} from '@api/features/quiz/infrastructure/drizzle/schema';
export type { UserProgressRow } from '@api/features/user/infrastructure/drizzle/schema';
export {
  subscriptionPlanEnum,
  subscriptionStatusEnum,
  subscriptions,
  userProgress,
  userRoleEnum as userFeatureRoleEnum,
} from '@api/features/user/infrastructure/drizzle/schema';

// System-wide schemas (remain in infra)
export { webhookStatusEnum } from './enums';
export { drizzleMigrations, testMigration, webhookEvent } from './system';
