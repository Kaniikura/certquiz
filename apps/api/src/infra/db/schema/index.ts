// Barrel export for all schema tables - organized by bounded context

// Re-export all tables and enums for migrations
export { subscriptionPlanEnum, subscriptionStatusEnum, userRoleEnum } from './enums';
export { bookmarks, question, questionVersion } from './question';
export { quizSessionEvent, quizSessionSnapshot } from './quiz';
export { drizzleMigrations, testMigration, webhookEvent } from './system';
export { authUser, subscriptions, userProgress } from './user';
