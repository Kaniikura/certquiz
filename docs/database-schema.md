# Database Schema Documentation

## Overview

PostgreSQL database schema using Drizzle ORM with full TypeScript support. All tables use UUID primary keys and include audit timestamps.

## Schema File Structure

```
apps/api/src/db/
├── schema.ts          # Main schema definitions
├── relations.ts       # Table relationships
├── migrations/        # Generated migrations
└── migrate.ts         # Migration runner
```

## Complete Schema Definition

```typescript
// apps/api/src/db/schema.ts
import { 
  pgTable, 
  uuid, 
  text, 
  timestamp, 
  boolean, 
  integer, 
  jsonb,
  pgEnum,
  index,
  uniqueIndex,
  real
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Enums
export const userRoleEnum = pgEnum('user_role', ['guest', 'user', 'premium', 'admin']);
export const questionTypeEnum = pgEnum('question_type', ['single', 'multiple']);
export const questionStatusEnum = pgEnum('question_status', ['active', 'pending', 'archived']);
export const reportTypeEnum = pgEnum('report_type', ['error', 'unclear', 'outdated']);
export const reportStatusEnum = pgEnum('report_status', ['pending', 'accepted', 'rejected']);
export const subscriptionPlanEnum = pgEnum('subscription_plan', ['free', 'premium']);
export const subscriptionStatusEnum = pgEnum('subscription_status', ['active', 'cancelled', 'expired']);

// Users table
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  username: text('username').notNull().unique(),
  keycloakId: text('keycloak_id').unique(),
  role: userRoleEnum('role').notNull().default('user'),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => {
  return {
    emailIdx: index('idx_users_email').on(table.email),
    keycloakIdx: index('idx_users_keycloak').on(table.keycloakId),
  };
});

// Questions table
export const questions = pgTable('questions', {
  id: uuid('id').primaryKey().defaultRandom(),
  examType: text('exam_type').notNull(), // CCNP, CCIE, etc.
  category: text('category').notNull(), // OSPF, QoS, etc.
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
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => {
  return {
    examCategoryIdx: index('idx_questions_exam_category').on(table.examType, table.category),
    statusIdx: index('idx_questions_status').on(table.status),
    createdByIdx: index('idx_questions_created_by').on(table.createdById),
    tagsIdx: index('idx_questions_tags').on(table.tags),
  };
});

// Question options table
export const questionOptions = pgTable('question_options', {
  id: uuid('id').primaryKey().defaultRandom(),
  questionId: uuid('question_id').notNull().references(() => questions.id, { onDelete: 'cascade' }),
  text: text('text').notNull(),
  isCorrect: boolean('is_correct').notNull().default(false),
  order: integer('order').notNull().default(0),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => {
  return {
    questionIdx: index('idx_options_question').on(table.questionId),
  };
});

// User progress table
export const userProgress = pgTable('user_progress', {
  userId: uuid('user_id').primaryKey().references(() => users.id, { onDelete: 'cascade' }),
  level: integer('level').notNull().default(1),
  experience: integer('experience').notNull().default(0),
  totalQuestions: integer('total_questions').notNull().default(0),
  correctAnswers: integer('correct_answers').notNull().default(0),
  accuracy: real('accuracy').notNull().default(0),
  studyTime: integer('study_time').notNull().default(0), // in minutes
  streak: integer('streak').notNull().default(0),
  lastStudyDate: timestamp('last_study_date'),
  categoryStats: jsonb('category_stats').notNull().default({}), // { [category]: { attempted, correct, accuracy } }
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
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
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => {
  return {
    categoryIdx: index('idx_badges_category').on(table.category),
  };
});

// User badges (many-to-many)
export const userBadges = pgTable('user_badges', {
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  badgeId: uuid('badge_id').notNull().references(() => badges.id, { onDelete: 'cascade' }),
  unlockedAt: timestamp('unlocked_at').notNull().defaultNow(),
}, (table) => {
  return {
    pk: uniqueIndex('pk_user_badges').on(table.userId, table.badgeId),
    userIdx: index('idx_user_badges_user').on(table.userId),
  };
});

// Quiz sessions table
export const quizSessions = pgTable('quiz_sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id),
  examType: text('exam_type'),
  category: text('category'),
  questionCount: integer('question_count').notNull(),
  currentIndex: integer('current_index').notNull().default(0),
  score: integer('score'),
  isPaused: boolean('is_paused').notNull().default(false),
  startedAt: timestamp('started_at').notNull().defaultNow(),
  completedAt: timestamp('completed_at'),
}, (table) => {
  return {
    userIdx: index('idx_sessions_user').on(table.userId),
    completedIdx: index('idx_sessions_completed').on(table.completedAt),
  };
});

// Quiz session questions (many-to-many with order)
export const sessionQuestions = pgTable('session_questions', {
  sessionId: uuid('session_id').notNull().references(() => quizSessions.id, { onDelete: 'cascade' }),
  questionId: uuid('question_id').notNull().references(() => questions.id),
  order: integer('order').notNull(),
  answeredAt: timestamp('answered_at'),
  selectedOptions: text('selected_options').array().default([]), // option IDs
  isCorrect: boolean('is_correct'),
}, (table) => {
  return {
    pk: uniqueIndex('pk_session_questions').on(table.sessionId, table.questionId),
    sessionIdx: index('idx_session_questions_session').on(table.sessionId),
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
  reviewedById: uuid('reviewed_by_id').references(() => users.id),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  resolvedAt: timestamp('resolved_at'),
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
  startDate: timestamp('start_date').notNull().defaultNow(),
  endDate: timestamp('end_date'),
  autoRenew: boolean('auto_renew').notNull().default(true),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => {
  return {
    emailIdx: index('idx_subscriptions_bmac_email').on(table.buyMeACoffeeEmail),
    statusIdx: index('idx_subscriptions_status').on(table.status),
  };
});

// Question bookmarks table
export const bookmarks = pgTable('bookmarks', {
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  questionId: uuid('question_id').notNull().references(() => questions.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
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
  editedAt: timestamp('edited_at').notNull().defaultNow(),
}, (table) => {
  return {
    questionVersionIdx: uniqueIndex('idx_history_question_version').on(table.questionId, table.version),
  };
});

// Audit log table (optional)
export const auditLogs = pgTable('audit_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id),
  action: text('action').notNull(), // login, logout, create_question, etc.
  entityType: text('entity_type'), // question, user, etc.
  entityId: uuid('entity_id'),
  metadata: jsonb('metadata').default({}),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => {
  return {
    userIdx: index('idx_audit_user').on(table.userId),
    actionIdx: index('idx_audit_action').on(table.action),
    createdIdx: index('idx_audit_created').on(table.createdAt),
  };
});
```

## Table Relations

```typescript
// apps/api/src/db/relations.ts
import { relations } from 'drizzle-orm';
import * as schema from './schema';

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

// Question relations
export const questionsRelations = relations(schema.questions, ({ one, many }) => ({
  creator: one(schema.users, {
    fields: [schema.questions.createdById],
    references: [schema.users.id],
  }),
  options: many(schema.questionOptions),
  reports: many(schema.problemReports),
  bookmarks: many(schema.bookmarks),
  history: many(schema.questionHistory),
}));

// Question options relations
export const questionOptionsRelations = relations(schema.questionOptions, ({ one }) => ({
  question: one(schema.questions, {
    fields: [schema.questionOptions.questionId],
    references: [schema.questions.id],
  }),
}));

// Other relations...
```

## Migration Setup

```typescript
// apps/api/src/db/migrate.ts
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';

const connectionString = process.env.DATABASE_URL!;
const sql = postgres(connectionString, { max: 1 });
const db = drizzle(sql);

async function main() {
  console.log('Running migrations...');
  await migrate(db, { migrationsFolder: './src/db/migrations' });
  console.log('Migrations complete!');
  process.exit(0);
}

main().catch((err) => {
  console.error('Migration failed!', err);
  process.exit(1);
});
```

## Database Connection

```typescript
// apps/api/src/db/index.ts
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';
import * as relations from './relations';

const connectionString = process.env.DATABASE_URL!;
const sql = postgres(connectionString);

export const db = drizzle(sql, { 
  schema: { ...schema, ...relations },
  logger: process.env.NODE_ENV === 'development',
});

export type Database = typeof db;
```

## Seed Data

```typescript
// apps/api/src/db/seed.ts
import { db } from './index';
import { users, badges, questions, questionOptions } from './schema';

async function seed() {
  console.log('Seeding database...');

  // Create admin user
  const [adminUser] = await db.insert(users).values({
    email: 'admin@certquiz.app',
    username: 'admin',
    role: 'admin',
  }).returning();

  // Create badges
  const badgeData = [
    {
      name: 'OSPF Master',
      description: 'Achieved 80% accuracy in OSPF questions',
      icon: 'ospf-master',
      category: 'routing',
      requirementType: 'category_mastery',
      requirementValue: 80,
      requirementCategory: 'OSPF',
    },
    {
      name: 'Quiz Streak',
      description: 'Studied for 7 consecutive days',
      icon: 'streak-7',
      category: 'dedication',
      requirementType: 'streak',
      requirementValue: 7,
    },
    // Add more badges...
  ];

  await db.insert(badges).values(badgeData);

  // Create sample questions
  const [question1] = await db.insert(questions).values({
    examType: 'CCNP',
    category: 'OSPF',
    tags: ['routing', 'ospf', 'basics'],
    questionText: 'What is the default OSPF hello interval on broadcast networks?',
    type: 'single',
    explanation: 'The default OSPF hello interval on broadcast networks is 10 seconds.',
    createdById: adminUser.id,
    createdByName: 'Admin',
  }).returning();

  // Create options for question
  await db.insert(questionOptions).values([
    { questionId: question1.id, text: '10 seconds', isCorrect: true, order: 0 },
    { questionId: question1.id, text: '30 seconds', isCorrect: false, order: 1 },
    { questionId: question1.id, text: '40 seconds', isCorrect: false, order: 2 },
    { questionId: question1.id, text: '60 seconds', isCorrect: false, order: 3 },
  ]);

  console.log('Seeding complete!');
}

seed().catch(console.error).finally(() => process.exit(0));
```

## Common Queries

```typescript
// Get questions with options
const questionsWithOptions = await db.query.questions.findMany({
  where: eq(questions.status, 'active'),
  with: {
    options: {
      orderBy: (options, { asc }) => [asc(options.order)],
    },
  },
  limit: 10,
});

// Get user progress with badges
const userWithProgress = await db.query.users.findFirst({
  where: eq(users.id, userId),
  with: {
    progress: true,
    badges: {
      with: {
        badge: true,
      },
    },
  },
});

// Update category stats
await db.update(userProgress)
  .set({
    categoryStats: sql`
      jsonb_set(
        category_stats,
        '{${category}}',
        jsonb_build_object(
          'attempted', COALESCE((category_stats->>${category}->>'attempted')::int, 0) + 1,
          'correct', COALESCE((category_stats->>${category}->>'correct')::int, 0) + ${isCorrect ? 1 : 0},
          'accuracy', 
            CASE 
              WHEN COALESCE((category_stats->>${category}->>'attempted')::int, 0) = 0 THEN 0
              ELSE (COALESCE((category_stats->>${category}->>'correct')::int, 0) + ${isCorrect ? 1 : 0})::float / 
                   (COALESCE((category_stats->>${category}->>'attempted')::int, 0) + 1) * 100
            END
        )
      )
    `,
    updatedAt: new Date(),
  })
  .where(eq(userProgress.userId, userId));
```

## Performance Considerations

1. **Indexes**: All foreign keys and commonly queried fields are indexed
2. **JSONB**: Used for flexible schema (category stats, audit metadata)
3. **Array columns**: PostgreSQL arrays for tags and selected options
4. **Soft deletes**: Use status fields instead of actual deletion
5. **UUID primary keys**: Better for distributed systems

## Maintenance Scripts

```bash
# Generate new migration
bun run db:generate

# Apply migrations
bun run db:migrate

# Open Drizzle Studio
bun run db:studio

# Seed database
bun run apps/api/src/db/seed.ts
```