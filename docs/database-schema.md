# Database Schema Documentation - Personal MVP

## Overview

PostgreSQL database schema for CertQuiz personal project. Optimized for simplicity and rapid development while maintaining future extensibility. Based on expert review recommendations for solo developer MVP.

## Design Principles (Personal Project Focus)

1. **Keep it simple** - Avoid premature optimization
2. **Essential constraints only** - PK/FK/UNIQUE/NOT NULL that prevent data corruption
3. **Minimal indexes** - Only for authentication and frequent JOINs
4. **Smart normalization** - Only normalize where it provides clear benefits (e.g., selectedOptions for analytics)
5. **JSONB for flexibility** - Keep categoryStats as JSONB with version field for future migration
6. **Arrays are OK** - PostgreSQL arrays work fine for tags at small scale

## Schema File Structure

```
apps/api/db/                     # Database files outside src/ for build optimization
├── schema/
│   ├── index.ts                # Main schema definitions
│   ├── enums.ts               # PostgreSQL enums
│   └── triggers.sql           # Database triggers
├── migrations/                 # Generated migrations
├── seeds/
│   └── initial.ts             # Initial seed data
└── index.ts                   # Database connection

apps/api/src/db/               # Runtime database access
└── index.ts                   # Re-exports from apps/api/db
```

## Complete Schema Definition

```typescript
// apps/api/db/schema/index.ts
import { 
  pgTable, 
  uuid, 
  text, 
  timestamp, 
  boolean, 
  integer, 
  decimal,
  jsonb,
  pgEnum,
  index,
  uniqueIndex
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

// Enums
export const userRoleEnum = pgEnum('user_role', ['guest', 'user', 'premium', 'admin']);
export const questionTypeEnum = pgEnum('question_type', ['single', 'multiple']);
export const questionStatusEnum = pgEnum('question_status', ['active', 'pending', 'archived']);
export const reportTypeEnum = pgEnum('report_type', ['error', 'unclear', 'outdated']);
export const reportStatusEnum = pgEnum('report_status', ['pending', 'accepted', 'rejected']);
export const subscriptionPlanEnum = pgEnum('subscription_plan', ['free', 'premium']);
export const subscriptionStatusEnum = pgEnum('subscription_status', ['active', 'cancelled', 'expired']);

// Exams table (lookup table for exam types)
export const exams = pgTable('exams', {
  id: uuid('id').primaryKey().defaultRandom(),
  code: text('code').notNull().unique(), // 'CCNA', 'CCNP_ENCOR', 'CCNP_ENARSI', etc.
  name: text('name').notNull(), // Full display name
  description: text('description'), // Optional description
  displayOrder: integer('display_order').notNull().default(0),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => {
  return {
    codeIdx: uniqueIndex('idx_exams_code').on(table.code),
    activeIdx: index('idx_exams_active').on(table.isActive),
  };
});

// Categories table (lookup table for question categories)
export const categories = pgTable('categories', {
  id: uuid('id').primaryKey().defaultRandom(),
  code: text('code').notNull().unique(), // 'NETWORK_FUNDAMENTALS', 'OSPF', 'QOS', etc.
  name: text('name').notNull(), // Full display name
  description: text('description'), // Optional description
  displayOrder: integer('display_order').notNull().default(0),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => {
  return {
    codeIdx: uniqueIndex('idx_categories_code').on(table.code),
    activeIdx: index('idx_categories_active').on(table.isActive),
  };
});

// Users table
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  username: text('username').notNull().unique(),
  keycloakId: text('keycloak_id').unique(),
  role: userRoleEnum('role').notNull().default('user'),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => {
  return {
    emailIdx: index('idx_users_email').on(table.email),
    keycloakIdx: index('idx_users_keycloak').on(table.keycloakId),
  };
});

// Questions table
export const questions = pgTable('questions', {
  id: uuid('id').primaryKey().defaultRandom(),
  tags: text('tags').array().notNull().default([]),
  questionText: text('question_text').notNull(),
  type: questionTypeEnum('type').notNull(),
  explanation: text('explanation').notNull(),
  detailedExplanation: text('detailed_explanation'),
  images: text('images').array().default([]),
  createdById: uuid('created_by_id').notNull().references(() => users.id),
  createdByName: text('created_by_name'),
  isUserGenerated: boolean('is_user_generated').notNull().default(false),
  isPremium: boolean('is_premium').notNull().default(false),
  status: questionStatusEnum('status').notNull().default('active'),
  version: integer('version').notNull().default(1),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => {
  return {
    statusIdx: index('idx_questions_status').on(table.status),
    createdByIdx: index('idx_questions_created_by').on(table.createdById),
    tagsGinIdx: index('idx_questions_tags_gin').using('gin').on(table.tags),
    // Partial index for active questions only
    activeQuestionsIdx: index('idx_active_questions')
      .on(table.status)
      .where(sql`status = 'active'`),
  };
});

// Question options table
export const questionOptions = pgTable('question_options', {
  id: uuid('id').primaryKey().defaultRandom(),
  questionId: uuid('question_id').notNull().references(() => questions.id, { onDelete: 'cascade' }),
  text: text('text').notNull(),
  isCorrect: boolean('is_correct').notNull().default(false),
  displayOrder: integer('display_order').notNull().default(0), // Renamed from 'order'
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => {
  return {
    questionIdx: index('idx_options_question').on(table.questionId),
    // Ensure unique display order per question
    uniqueOrderPerQuestion: uniqueIndex('unq_question_display_order')
      .on(table.questionId, table.displayOrder),
  };
});

// Question-Exam junction table (many-to-many)
export const questionExams = pgTable('question_exams', {
  questionId: uuid('question_id').notNull().references(() => questions.id, { onDelete: 'cascade' }),
  examId: uuid('exam_id').notNull().references(() => exams.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => {
  return {
    pk: uniqueIndex('pk_question_exams').on(table.questionId, table.examId),
    questionIdx: index('idx_question_exams_question').on(table.questionId), // Added missing FK index
    examIdx: index('idx_question_exams_exam').on(table.examId),
  };
});

// Question-Category junction table (many-to-many)
export const questionCategories = pgTable('question_categories', {
  questionId: uuid('question_id').notNull().references(() => questions.id, { onDelete: 'cascade' }),
  categoryId: uuid('category_id').notNull().references(() => categories.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => {
  return {
    pk: uniqueIndex('pk_question_categories').on(table.questionId, table.categoryId),
    questionIdx: index('idx_question_categories_question').on(table.questionId), // Added missing FK index
    categoryIdx: index('idx_question_categories_category').on(table.categoryId),
  };
});

// User progress table
export const userProgress = pgTable('user_progress', {
  userId: uuid('user_id').primaryKey().references(() => users.id, { onDelete: 'cascade' }),
  level: integer('level').notNull().default(1),
  experience: integer('experience').notNull().default(0),
  totalQuestions: integer('total_questions').notNull().default(0),
  correctAnswers: integer('correct_answers').notNull().default(0),
  accuracy: decimal('accuracy', { precision: 5, scale: 2 }).notNull().default('0.00'),
  studyTime: integer('study_time').notNull().default(0), // in minutes
  streak: integer('streak').notNull().default(0),
  lastStudyDate: timestamp('last_study_date', { withTimezone: true }),
  categoryStats: jsonb('category_stats').notNull().default({ version: 1 }), // Added version field for future migrations
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// Badges table
export const badges = pgTable('badges', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull().unique(),
  description: text('description').notNull(),
  icon: text('icon').notNull(),
  category: text('category').notNull(),
  requirementType: text('requirement_type').notNull(), // questions_solved, accuracy, streak, category_mastery
  requirementValue: integer('requirement_value').notNull(),
  requirementCategory: text('requirement_category'), // for category-specific badges
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => {
  return {
    categoryIdx: index('idx_badges_category').on(table.category),
  };
});

// User badges (many-to-many)
export const userBadges = pgTable('user_badges', {
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  badgeId: uuid('badge_id').notNull().references(() => badges.id, { onDelete: 'cascade' }),
  unlockedAt: timestamp('unlocked_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => {
  return {
    pk: uniqueIndex('pk_user_badges').on(table.userId, table.badgeId),
    userIdx: index('idx_user_badges_user').on(table.userId),
    badgeIdx: index('idx_user_badges_badge').on(table.badgeId), // Added missing FK index
  };
});

// Quiz sessions table
export const quizSessions = pgTable('quiz_sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  examId: uuid('exam_id').references(() => exams.id, { onDelete: 'set null' }), // Optional: filter by specific exam
  categoryId: uuid('category_id').references(() => categories.id, { onDelete: 'set null' }), // Optional: filter by specific category
  questionCount: integer('question_count').notNull(),
  currentIndex: integer('current_index').notNull().default(0),
  score: integer('score'),
  isPaused: boolean('is_paused').notNull().default(false),
  startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
  completedAt: timestamp('completed_at', { withTimezone: true }),
}, (table) => {
  return {
    userIdx: index('idx_sessions_user').on(table.userId),
    completedIdx: index('idx_sessions_completed').on(table.completedAt),
    examIdx: index('idx_sessions_exam').on(table.examId),
    categoryIdx: index('idx_sessions_category').on(table.categoryId),
    // Composite index for active sessions
    userStartedIdx: index('idx_sessions_user_started').on(table.userId, table.startedAt),
  };
});

// Quiz session questions (many-to-many with order)
export const sessionQuestions = pgTable('session_questions', {
  sessionId: uuid('session_id').notNull().references(() => quizSessions.id, { onDelete: 'cascade' }),
  questionId: uuid('question_id').notNull().references(() => questions.id),
  questionOrder: integer('question_order').notNull(),
  answeredAt: timestamp('answered_at', { withTimezone: true }),
  isCorrect: boolean('is_correct'),
}, (table) => {
  return {
    pk: uniqueIndex('pk_session_questions').on(table.sessionId, table.questionId),
    sessionIdx: index('idx_session_questions_session').on(table.sessionId),
    questionIdx: index('idx_session_questions_question').on(table.questionId), // Added missing FK index
  };
});

// Session selected options (normalized from array)
export const sessionSelectedOptions = pgTable('session_selected_options', {
  sessionId: uuid('session_id').notNull().references(() => quizSessions.id, { onDelete: 'cascade' }),
  questionId: uuid('question_id').notNull().references(() => questions.id),
  optionId: uuid('option_id').notNull().references(() => questionOptions.id),
  selectedAt: timestamp('selected_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => {
  return {
    pk: uniqueIndex('pk_session_selected_options').on(table.sessionId, table.questionId, table.optionId),
    sessionQuestionIdx: index('idx_session_selected_session_question').on(table.sessionId, table.questionId),
    optionIdx: index('idx_session_selected_option').on(table.optionId),
  };
});

// Problem reports table
export const problemReports = pgTable('problem_reports', {
  id: uuid('id').primaryKey().defaultRandom(),
  questionId: uuid('question_id').notNull().references(() => questions.id),
  reporterId: uuid('reporter_id').notNull().references(() => users.id),
  type: reportTypeEnum('type').notNull(),
  description: text('description').notNull(),
  status: reportStatusEnum('status').notNull().default('pending'),
  adminComment: text('admin_comment'),
  reviewedById: uuid('reviewed_by_id').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  resolvedAt: timestamp('resolved_at', { withTimezone: true }),
}, (table) => {
  return {
    questionIdx: index('idx_reports_question').on(table.questionId),
    reporterIdx: index('idx_reports_reporter').on(table.reporterId),
    statusIdx: index('idx_reports_status').on(table.status),
  };
});

// Subscriptions table
export const subscriptions = pgTable('subscriptions', {
  userId: uuid('user_id').primaryKey().references(() => users.id),
  plan: subscriptionPlanEnum('plan').notNull().default('free'),
  status: subscriptionStatusEnum('status').notNull().default('active'),
  buyMeACoffeeEmail: text('buy_me_a_coffee_email'),
  startDate: timestamp('start_date', { withTimezone: true }).notNull().defaultNow(),
  endDate: timestamp('end_date', { withTimezone: true }),
  autoRenew: boolean('auto_renew').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => {
  return {
    emailIdx: index('idx_subscriptions_bmac_email').on(table.buyMeACoffeeEmail),
    statusIdx: index('idx_subscriptions_status').on(table.status),
    // Unique constraint for Buy Me a Coffee email
    uniqueBmacEmail: uniqueIndex('unq_bmac_email').on(table.buyMeACoffeeEmail),
  };
});

// Question bookmarks table
export const bookmarks = pgTable('bookmarks', {
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  questionId: uuid('question_id').notNull().references(() => questions.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => {
  return {
    pk: uniqueIndex('pk_bookmarks').on(table.userId, table.questionId),
    userIdx: index('idx_bookmarks_user').on(table.userId),
  };
});

// Question history table (for versioning)
export const questionHistory = pgTable('question_history', {
  id: uuid('id').primaryKey().defaultRandom(),
  questionId: uuid('question_id').notNull().references(() => questions.id),
  version: integer('version').notNull(),
  changes: jsonb('changes').notNull(), // JSON diff of changes
  editedById: uuid('edited_by_id').notNull().references(() => users.id),
  editedAt: timestamp('edited_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => {
  return {
    questionVersionIdx: uniqueIndex('idx_history_question_version').on(table.questionId, table.version),
  };
});

// Webhook events table (for payment processing)
export const webhookEvents = pgTable('webhook_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  eventType: text('event_type').notNull(), // 'subscription.created', 'subscription.cancelled', etc.
  externalEventId: text('external_event_id').unique(), // External service event ID for deduplication
  payload: jsonb('payload').notNull(), // Raw webhook payload
  processedAt: timestamp('processed_at', { withTimezone: true }), // NULL if not processed yet
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => {
  return {
    eventTypeIdx: index('idx_webhook_events_type').on(table.eventType),
    processedAtIdx: index('idx_webhook_events_processed').on(table.processedAt), // For finding unprocessed events
    // externalEventId already has unique index
  };
});

// Audit log table (defer to Phase 2)
// Removed for MVP simplicity - add when you need compliance/detailed tracking
```

## Table Relations

```typescript
// apps/api/db/schema/relations.ts
import { relations } from 'drizzle-orm';
import * as schema from './index';

// User relations
export const usersRelations = relations(schema.users, ({ one, many }) => ({
  progress: one(schema.userProgress),
  subscription: one(schema.subscriptions),
  badges: many(schema.userBadges),
  createdQuestions: many(schema.questions),
  reports: many(schema.problemReports),
  sessions: many(schema.quizSessions),
  bookmarks: many(schema.bookmarks),
}));

// Exam relations
export const examsRelations = relations(schema.exams, ({ many }) => ({
  questions: many(schema.questionExams),
}));

// Category relations
export const categoriesRelations = relations(schema.categories, ({ many }) => ({
  questions: many(schema.questionCategories),
}));

// Question relations
export const questionsRelations = relations(schema.questions, ({ one, many }) => ({
  creator: one(schema.users, {
    fields: [schema.questions.createdById],
    references: [schema.users.id],
  }),
  options: many(schema.questionOptions),
  exams: many(schema.questionExams),
  categories: many(schema.questionCategories),
  reports: many(schema.problemReports),
  bookmarks: many(schema.bookmarks),
  history: many(schema.questionHistory),
}));

// Question-Exam junction relations
export const questionExamsRelations = relations(schema.questionExams, ({ one }) => ({
  question: one(schema.questions, {
    fields: [schema.questionExams.questionId],
    references: [schema.questions.id],
  }),
  exam: one(schema.exams, {
    fields: [schema.questionExams.examId],
    references: [schema.exams.id],
  }),
}));

// Question-Category junction relations
export const questionCategoriesRelations = relations(schema.questionCategories, ({ one }) => ({
  question: one(schema.questions, {
    fields: [schema.questionCategories.questionId],
    references: [schema.questions.id],
  }),
  category: one(schema.categories, {
    fields: [schema.questionCategories.categoryId],
    references: [schema.categories.id],
  }),
}));

// Question options relations
export const questionOptionsRelations = relations(schema.questionOptions, ({ one }) => ({
  question: one(schema.questions, {
    fields: [schema.questionOptions.questionId],
    references: [schema.questions.id],
  }),
}));

// Quiz session relations
export const quizSessionsRelations = relations(schema.quizSessions, ({ one, many }) => ({
  user: one(schema.users, {
    fields: [schema.quizSessions.userId],
    references: [schema.users.id],
  }),
  exam: one(schema.exams, {
    fields: [schema.quizSessions.examId],
    references: [schema.exams.id],
  }),
  category: one(schema.categories, {
    fields: [schema.quizSessions.categoryId],
    references: [schema.categories.id],
  }),
  questions: many(schema.sessionQuestions),
}));

// Session questions relations
export const sessionQuestionsRelations = relations(schema.sessionQuestions, ({ one, many }) => ({
  session: one(schema.quizSessions, {
    fields: [schema.sessionQuestions.sessionId],
    references: [schema.quizSessions.id],
  }),
  question: one(schema.questions, {
    fields: [schema.sessionQuestions.questionId],
    references: [schema.questions.id],
  }),
  selectedOptions: many(schema.sessionSelectedOptions),
}));

// Session selected options relations
export const sessionSelectedOptionsRelations = relations(schema.sessionSelectedOptions, ({ one }) => ({
  session: one(schema.quizSessions, {
    fields: [schema.sessionSelectedOptions.sessionId],
    references: [schema.quizSessions.id],
  }),
  question: one(schema.questions, {
    fields: [schema.sessionSelectedOptions.questionId],
    references: [schema.questions.id],
  }),
  option: one(schema.questionOptions, {
    fields: [schema.sessionSelectedOptions.optionId],
    references: [schema.questionOptions.id],
  }),
}));

// User progress relations
export const userProgressRelations = relations(schema.userProgress, ({ one }) => ({
  user: one(schema.users, {
    fields: [schema.userProgress.userId],
    references: [schema.users.id],
  }),
}));
```

## Database Triggers

```sql
-- apps/api/db/schema/triggers.sql

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply trigger to all tables with updated_at column
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_questions_updated_at BEFORE UPDATE ON questions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_progress_updated_at BEFORE UPDATE ON user_progress
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_subscriptions_updated_at BEFORE UPDATE ON subscriptions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_exams_updated_at BEFORE UPDATE ON exams
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_categories_updated_at BEFORE UPDATE ON categories
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

## Migration & Seed Setup

```typescript
// apps/api/db/migrate.ts
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';

const sql = postgres(process.env.DATABASE_URL!, { max: 1 });
const db = drizzle(sql);

await migrate(db, { migrationsFolder: './db/migrations' });
await sql`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`;
// Apply triggers from triggers.sql separately

// Add JSONB constraints
await sql`ALTER TABLE user_progress ADD CONSTRAINT chk_category_stats_version CHECK (category_stats ? 'version')`;

await sql.end();
```

## Database Connection

```typescript
// apps/api/src/db/index.ts
// Re-export the database instance from the shared wrapper
export { db, type Database } from '@api/shared/database';

// Re-export schema for easy access
export * from '@api/schema';
export * from '@api/schema/relations';
```

## Seed Data Example

```typescript
// apps/api/db/seeds/initial.ts - Simplified seed for MVP
import { db } from '@api/shared/database';
import { users, exams, categories, questions, questionOptions, questionExams, questionCategories, badges } from '@api/schema';

// Create admin user
const [adminUser] = await db.insert(users).values({
  email: 'admin@certquiz.app',
  username: 'admin',
  role: 'admin',
}).returning();

// Create basic exam types
await db.insert(exams).values([
  { code: 'CCNA', name: 'Cisco Certified Network Associate', displayOrder: 1 },
  { code: 'CCNP_ENCOR', name: 'CCNP Enterprise Core', displayOrder: 2 },
]);

// Create basic categories
await db.insert(categories).values([
  { code: 'NETWORK_FUNDAMENTALS', name: 'Network Fundamentals', displayOrder: 1 },
  { code: 'OSPF', name: 'OSPF', displayOrder: 2 },
]);

// Add a few sample questions with junction table relationships
// See full example in db/seeds/initial.ts
```

## Basic Query Examples

```typescript
// Get questions with options
const questionsWithOptions = await db.query.questions.findMany({
  where: eq(questions.status, 'active'),
  with: {
    options: {
      orderBy: (options, { asc }) => [asc(options.displayOrder)],
    },
  },
  limit: 10,
});

// Record selected answer (normalized)
await db.insert(sessionSelectedOptions).values({
  sessionId,
  questionId,
  optionId,
});

// Update category stats in JSONB
await db.update(userProgress)
  .set({
    categoryStats: sql`
      jsonb_set(
        category_stats,
        '{${category}}',
        jsonb_build_object(
          'version', 1,
          'attempted', COALESCE((category_stats->>${category}->>'attempted')::int, 0) + 1,
          'correct', COALESCE((category_stats->>${category}->>'correct')::int, 0) + ${isCorrect ? 1 : 0}
        )
      )
    `,
  })
  .where(eq(userProgress.userId, userId));
```

## Maintenance Scripts

```bash
# Generate new migration
bun run db:generate

# Apply migrations
bun run db:migrate

# Seed database
bun run apps/api/db/seeds/initial.ts
```

## MVP Implementation Notes

### What We're Building
- Simple quiz application with question banks
- User progress tracking with basic gamification
- Premium tier support via Buy Me a Coffee
- Community features (problem reporting)

### What We're Deferring
- Complex indexes (add as needed)
- Audit logs (add when compliance needed)
- Partitioning (add when tables exceed 50M rows)
- Row-level security (using app-level filtering for now)
- Advanced analytics tables

### Key Decisions for Personal MVP
1. **selectedOptions normalized** - The only array we normalized for future analytics
2. **categoryStats as JSONB** - Flexible with version field for future migration (with CHECK constraint)
3. **tags remain as array** - Works fine for small scale, easy to query
4. **Essential indexes only** - FK indexes and authentication queries
5. **Simple triggers** - Just updated_at timestamp automation
6. **webhookEvents table** - Store raw webhook payloads for payment processing reliability

### Future Migration Path
When your app grows beyond a personal project:
1. Add missing performance indexes
2. Normalize tags if needed
3. Add RLS policies (user_id is already in place)
4. Consider separating categoryStats to its own table
5. Add audit logging
6. Implement table partitioning for large tables

## Security Notes for MVP

### Essential Security (Do Now)
- ✅ All tables have proper FK constraints
- ✅ Use parameterized queries (Drizzle handles this)
- ✅ Environment variables for DATABASE_URL
- ✅ bcrypt for password hashing (in app layer)
- ✅ Weekly backups (use managed DB service)
- ✅ Webhook signature verification (check externalEventId for deduplication)

### Defer Until Later
- ⏸️ Row-level security (use app-level user_id filtering)
- ⏸️ Detailed audit logs
- ⏸️ Database encryption at rest (managed DB handles this)
- ⏸️ Complex permission systems
