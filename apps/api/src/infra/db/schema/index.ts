// Barrel export for all schema tables - organized by bounded context
// This file is used by migrations to access all tables

export type { AuthUserRow } from '@api/features/auth/infrastructure/drizzle/schema/authUser';
// Re-export feature schemas for migrations
export { authUser } from '@api/features/auth/infrastructure/drizzle/schema/authUser';
export { bookmarks } from '@api/features/question/infrastructure/drizzle/schema/bookmarks';
export {
  difficultyEnum,
  questionStatusEnum,
  questionTypeEnum,
} from '@api/features/question/infrastructure/drizzle/schema/enums';
export type {
  QuestionRow,
  QuestionVersionRow,
} from '@api/features/question/infrastructure/drizzle/schema/question';
export {
  question,
  questionVersion,
} from '@api/features/question/infrastructure/drizzle/schema/question';
export { quizStateEnum } from '@api/features/quiz/infrastructure/drizzle/schema/enums';
export type { QuizSessionEventRow } from '@api/features/quiz/infrastructure/drizzle/schema/quizSession';
export {
  quizSessionEvent,
  quizSessionSnapshot,
} from '@api/features/quiz/infrastructure/drizzle/schema/quizSession';
export {
  subscriptionPlanEnum,
  subscriptionStatusEnum,
  userRoleEnum,
} from '@api/features/user/infrastructure/drizzle/schema/enums';
export { subscriptions } from '@api/features/user/infrastructure/drizzle/schema/subscriptions';
export type { UserProgressRow } from '@api/features/user/infrastructure/drizzle/schema/userProgress';
export { userProgress } from '@api/features/user/infrastructure/drizzle/schema/userProgress';

// System-wide schemas (remain in infra)
export { webhookStatusEnum } from './enums';
export { drizzleMigrations, testMigration, webhookEvent } from './system';
