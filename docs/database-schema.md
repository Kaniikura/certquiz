# Database Schema Documentation - VSA + DDD Architecture

## Overview

PostgreSQL database schema for CertQuiz using Vertical Slice Architecture (VSA) with Domain-Driven Design (DDD). The schema is kept centralized as infrastructure while supporting rich domain models through the DbContext pattern.

## Architecture Principles

1. **Infrastructure Layer** - All Drizzle table definitions remain centralized in `db/schema/`
2. **DbContext Pattern** - Request-scoped wrapper providing typed database access
3. **Domain Modeling** - Entities and value objects map to/from database rows
4. **Type Exports** - Each schema file exports row types for domain mapping
5. **Bounded Context Organization** - Tables grouped by domain boundaries

## Schema Organization

```
apps/api/db/
├── schema/                      # Centralized table definitions (infrastructure)
│   ├── index.ts                # Barrel export with bounded context grouping
│   ├── enums.ts               # PostgreSQL enums
│   ├── user.ts                # User bounded context tables
│   ├── quiz.ts                # Quiz bounded context tables
│   ├── question.ts            # Question bounded context tables
│   ├── exam.ts                # Exam/Category lookup tables
│   ├── community.ts           # Community features (badges, reports)
│   ├── system.ts              # System tables (webhooks, etc.)
│   └── relations.ts           # Drizzle ORM relationships
├── migrations/                 # Generated migration files
├── seeds/                      # Seed data
└── DbContext.ts               # Database context implementation
```

## DbContext Implementation

```typescript
// apps/api/db/DbContext.ts
import { drizzle, type PostgresJsDatabase, type PostgresJsTransaction } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

// Singleton connection pool
const pool = postgres(process.env.DATABASE_URL!, { 
  max: process.env.NODE_ENV === 'production' ? 20 : 5 
});
const db = drizzle(pool, { schema });

export type DrizzleDb = PostgresJsDatabase<typeof schema>;

// Request-scoped wrapper
export class DbContext {
  constructor(private readonly conn: DrizzleDb | PostgresJsTransaction<typeof schema>) {}

  // Direct access to Drizzle instance
  get sql() { return this.conn; }
  get query() { return this.conn.query; }

  // Convenience methods for common queries
  users = {
    findById: (id: string) =>
      this.conn.query.users.findFirst({
        where: (u, { eq }) => eq(u.id, id),
      }),
    findByEmail: (email: string) =>
      this.conn.query.users.findFirst({
        where: (u, { eq }) => eq(u.email, email),
      }),
  };

  // Transaction support with improved type safety
  async transaction<T>(fn: (tx: DbContext) => Promise<T>): Promise<T> {
    return this.conn.transaction(async (trx: PostgresJsTransaction<typeof schema>) => 
      fn(new DbContext(trx))
    );
  }
}

// Factory for creating request-scoped instances
export const createDbContext = () => new DbContext(db);

// Graceful shutdown
export const closeDatabase = async () => {
  await pool.end();
};
```

## Bounded Context Exports

```typescript
// apps/api/db/schema/index.ts - Improved barrel export by bounded context
export * as user from './user';
export * as quiz from './quiz';
export * as question from './question';
export * as exam from './exam';
export * as community from './community';
export * as system from './system';

// Re-export all for migrations
export * from './enums';
export * from './user';
export * from './quiz';
export * from './question';
export * from './exam';
export * from './community';
export * from './system';
```

This allows cleaner imports in feature slices:
```typescript
// In feature files
import { quiz, question } from '@api-db/schema';

// Usage
const sessions = await ctx.sql.select().from(quiz.quizSessions);
const questions = await ctx.sql.select().from(question.questions);
```

## User Bounded Context

```typescript
// apps/api/db/schema/user.ts
import { pgTable, uuid, text, timestamp, boolean, integer, decimal, jsonb, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { userRoleEnum, subscriptionPlanEnum, subscriptionStatusEnum } from './enums';

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
}, (table) => [
  index('idx_users_email').on(table.email),
  index('idx_users_keycloak').on(table.keycloakId),
]);

// Type exports for domain mapping
export type UserRow = typeof users.$inferSelect;
export type NewUserRow = typeof users.$inferInsert;

// User progress tracking
export const userProgress = pgTable('user_progress', {
  userId: uuid('user_id').primaryKey().references(() => users.id, { onDelete: 'cascade' }),
  level: integer('level').notNull().default(1),
  experience: integer('experience').notNull().default(0),
  totalQuestions: integer('total_questions').notNull().default(0),
  correctAnswers: integer('correct_answers').notNull().default(0),
  accuracy: decimal('accuracy', { precision: 5, scale: 2 }).notNull().default('0.00'),
  studyTime: integer('study_time').notNull().default(0), // minutes
  streak: integer('streak').notNull().default(0),
  lastStudyDate: timestamp('last_study_date', { withTimezone: true }),
  categoryStats: jsonb('category_stats').notNull().default({ version: 1 }),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export type UserProgressRow = typeof userProgress.$inferSelect;
export type NewUserProgressRow = typeof userProgress.$inferInsert;

// Subscriptions
export const subscriptions = pgTable('subscriptions', {
  userId: uuid('user_id').primaryKey().references(() => users.id, { onDelete: 'cascade' }),
  plan: subscriptionPlanEnum('plan').notNull().default('free'),
  status: subscriptionStatusEnum('status').notNull().default('active'),
  buyMeACoffeeEmail: text('buy_me_a_coffee_email'),
  startDate: timestamp('start_date', { withTimezone: true }).notNull().defaultNow(),
  endDate: timestamp('end_date', { withTimezone: true }),
  autoRenew: boolean('auto_renew').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('idx_subscriptions_bmac_email').on(table.buyMeACoffeeEmail),
  index('idx_subscriptions_status').on(table.status),
  uniqueIndex('unq_bmac_email').on(table.buyMeACoffeeEmail),
]);

export type SubscriptionRow = typeof subscriptions.$inferSelect;
export type NewSubscriptionRow = typeof subscriptions.$inferInsert;
```

## Quiz Bounded Context

```typescript
// apps/api/db/schema/quiz.ts
import { pgTable, uuid, integer, timestamp, boolean, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { users } from './user';
import { exams, categories } from './exam';
import { questions, questionOptions } from './question';

// Quiz sessions
export const quizSessions = pgTable('quiz_sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  examId: uuid('exam_id').references(() => exams.id, { onDelete: 'set null' }),
  categoryId: uuid('category_id').references(() => categories.id, { onDelete: 'set null' }),
  questionCount: integer('question_count').notNull(),
  currentIndex: integer('current_index').notNull().default(0),
  score: integer('score'),
  isPaused: boolean('is_paused').notNull().default(false),
  startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
  completedAt: timestamp('completed_at', { withTimezone: true }),
}, (table) => [
  index('idx_sessions_user').on(table.userId),
  index('idx_sessions_completed').on(table.completedAt),
  index('idx_sessions_exam').on(table.examId),
  index('idx_sessions_category').on(table.categoryId),
  index('idx_sessions_user_started').on(table.userId, table.startedAt),
]);

export type QuizSessionRow = typeof quizSessions.$inferSelect;
export type NewQuizSessionRow = typeof quizSessions.$inferInsert;

// Session questions (many-to-many with order)
export const sessionQuestions = pgTable('session_questions', {
  sessionId: uuid('session_id').notNull().references(() => quizSessions.id, { onDelete: 'cascade' }),
  questionId: uuid('question_id').notNull().references(() => questions.id),
  questionOrder: integer('question_order').notNull(),
  answeredAt: timestamp('answered_at', { withTimezone: true }),
  isCorrect: boolean('is_correct'),
}, (table) => [
  uniqueIndex('pk_session_questions').on(table.sessionId, table.questionId),
  index('idx_session_questions_session').on(table.sessionId),
  index('idx_session_questions_question').on(table.questionId),
]);

export type SessionQuestionRow = typeof sessionQuestions.$inferSelect;
export type NewSessionQuestionRow = typeof sessionQuestions.$inferInsert;

// Selected options (normalized for analytics)
export const sessionSelectedOptions = pgTable('session_selected_options', {
  sessionId: uuid('session_id').notNull().references(() => quizSessions.id, { onDelete: 'cascade' }),
  questionId: uuid('question_id').notNull().references(() => questions.id),
  optionId: uuid('option_id').notNull().references(() => questionOptions.id),
  selectedAt: timestamp('selected_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex('pk_session_selected_options').on(table.sessionId, table.questionId, table.optionId),
  index('idx_session_selected_session_question').on(table.sessionId, table.questionId),
  index('idx_session_selected_option').on(table.optionId),
]);

export type SessionSelectedOptionRow = typeof sessionSelectedOptions.$inferSelect;
export type NewSessionSelectedOptionRow = typeof sessionSelectedOptions.$inferInsert;
```

## Question Bounded Context

```typescript
// apps/api/db/schema/question.ts
import { pgTable, uuid, text, timestamp, boolean, integer, jsonb, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { questionTypeEnum, questionStatusEnum } from './enums';
import { users } from './user';
import { exams, categories } from './exam';

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
}, (table) => [
  index('idx_questions_status').on(table.status),
  index('idx_questions_created_by').on(table.createdById),
  index('idx_questions_tags_gin').using('gin').on(table.tags),
  index('idx_active_questions').on(table.status).where(sql`status = 'active'`),
]);

export type QuestionRow = typeof questions.$inferSelect;
export type NewQuestionRow = typeof questions.$inferInsert;

// Question options
export const questionOptions = pgTable('question_options', {
  id: uuid('id').primaryKey().defaultRandom(),
  questionId: uuid('question_id').notNull().references(() => questions.id, { onDelete: 'cascade' }),
  text: text('text').notNull(),
  isCorrect: boolean('is_correct').notNull().default(false),
  displayOrder: integer('display_order').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('idx_options_question').on(table.questionId),
  uniqueIndex('unq_question_display_order').on(table.questionId, table.displayOrder),
]);

export type QuestionOptionRow = typeof questionOptions.$inferSelect;
export type NewQuestionOptionRow = typeof questionOptions.$inferInsert;

// Question-Exam junction
export const questionExams = pgTable('question_exams', {
  questionId: uuid('question_id').notNull().references(() => questions.id, { onDelete: 'cascade' }),
  examId: uuid('exam_id').notNull().references(() => exams.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex('pk_question_exams').on(table.questionId, table.examId),
  index('idx_question_exams_question').on(table.questionId),
  index('idx_question_exams_exam').on(table.examId),
]);

export type QuestionExamRow = typeof questionExams.$inferSelect;
export type NewQuestionExamRow = typeof questionExams.$inferInsert;

// Question-Category junction
export const questionCategories = pgTable('question_categories', {
  questionId: uuid('question_id').notNull().references(() => questions.id, { onDelete: 'cascade' }),
  categoryId: uuid('category_id').notNull().references(() => categories.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex('pk_question_categories').on(table.questionId, table.categoryId),
  index('idx_question_categories_question').on(table.questionId),
  index('idx_question_categories_category').on(table.categoryId),
]);

export type QuestionCategoryRow = typeof questionCategories.$inferSelect;
export type NewQuestionCategoryRow = typeof questionCategories.$inferInsert;

// Question history for versioning
export const questionHistory = pgTable('question_history', {
  id: uuid('id').primaryKey().defaultRandom(),
  questionId: uuid('question_id').notNull().references(() => questions.id),
  version: integer('version').notNull(),
  changes: jsonb('changes').notNull(),
  editedById: uuid('edited_by_id').notNull().references(() => users.id),
  editedAt: timestamp('edited_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex('idx_history_question_version').on(table.questionId, table.version),
]);

export type QuestionHistoryRow = typeof questionHistory.$inferSelect;
export type NewQuestionHistoryRow = typeof questionHistory.$inferInsert;

// Bookmarks
export const bookmarks = pgTable('bookmarks', {
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  questionId: uuid('question_id').notNull().references(() => questions.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex('pk_bookmarks').on(table.userId, table.questionId),
  index('idx_bookmarks_user').on(table.userId),
]);

export type BookmarkRow = typeof bookmarks.$inferSelect;
export type NewBookmarkRow = typeof bookmarks.$inferInsert;
```

## Feature Slice Query Pattern

```typescript
// features/quiz/start-quiz/queries.ts
import { DbContext } from '@api-db/DbContext';
import { quiz, question } from '@api-db/schema';
import { eq, sql } from 'drizzle-orm';

export const startQuizQueries = {
  // Get random questions for quiz
  async getRandomQuestions(ctx: DbContext, count: number, filters?: {
    examId?: string;
    categoryId?: string;
  }) {
    const query = ctx.sql
      .select()
      .from(question.questions)
      .where(eq(question.questions.status, 'active'))
      .orderBy(sql`RANDOM()`)
      .limit(count);
    
    return query;
  },

  // Create quiz session with questions
  async createSession(ctx: DbContext, data: {
    userId: string;
    questionIds: string[];
    examId?: string;
    categoryId?: string;
  }) {
    return ctx.transaction(async (tx) => {
      // Insert session
      const [session] = await tx.sql
        .insert(quiz.quizSessions)
        .values({
          userId: data.userId,
          questionCount: data.questionIds.length,
          examId: data.examId,
          categoryId: data.categoryId,
        })
        .returning();

      // Insert session questions
      await tx.sql.insert(quiz.sessionQuestions).values(
        data.questionIds.map((questionId, index) => ({
          sessionId: session.id,
          questionId,
          questionOrder: index,
        }))
      );

      return session;
    });
  },
};
```

## N+1 Query Prevention

```typescript
// ❌ BAD: N+1 problem
const session = await ctx.query.quizSessions.findFirst({ where: eq(quiz.quizSessions.id, id) });
for (const sq of session.questions) {
  const q = await ctx.query.questions.findFirst({ where: eq(question.questions.id, sq.questionId) });
}

// ✅ GOOD: Single query with joins
const result = await ctx.sql
  .select({
    session: quiz.quizSessions,
    question: question.questions,
    options: question.questionOptions,
  })
  .from(quiz.quizSessions)
  .innerJoin(quiz.sessionQuestions, eq(quiz.sessionQuestions.sessionId, quiz.quizSessions.id))
  .innerJoin(question.questions, eq(question.questions.id, quiz.sessionQuestions.questionId))
  .leftJoin(question.questionOptions, eq(question.questionOptions.questionId, question.questions.id))
  .where(eq(quiz.quizSessions.id, sessionId));

// ✅ GOOD: Batch fetch with inArray
const users = await ctx.sql
  .select()
  .from(user.users)
  .where(inArray(user.users.id, userIds));
```

## Domain Mapping Pattern

```typescript
// features/quiz/domain/entities/QuizSession.ts
import { QuizSessionRow } from '@api-db/schema';

export class QuizSession {
  private constructor(
    public readonly id: string,
    public readonly userId: string,
    public readonly questionCount: number,
    public readonly currentIndex: number,
    private _score: number,
    private _startedAt: Date,
    private _completedAt?: Date,
  ) {}

  // Factory method for creating new sessions
  static create(props: {
    userId: string;
    questionCount: number;
  }): QuizSession {
    return new QuizSession(
      crypto.randomUUID(),
      props.userId,
      props.questionCount,
      0,
      0,
      new Date(),
    );
  }

  // Restore from database
  static fromRow(row: QuizSessionRow): QuizSession {
    return new QuizSession(
      row.id,
      row.userId,
      row.questionCount,
      row.currentIndex,
      row.score ?? 0,
      row.startedAt,
      row.completedAt ?? undefined,
    );
  }

  // Convert to database row
  toRow(): Partial<QuizSessionRow> {
    return {
      id: this.id,
      userId: this.userId,
      questionCount: this.questionCount,
      currentIndex: this.currentIndex,
      score: this._score,
      startedAt: this._startedAt,
      completedAt: this._completedAt,
    };
  }

  // Domain logic
  answerQuestion(isCorrect: boolean): void {
    if (isCorrect) this._score++;
    this.currentIndex++;
  }

  complete(): void {
    this._completedAt = new Date();
  }

  get isComplete(): boolean {
    return this.currentIndex >= this.questionCount;
  }

  get accuracy(): number {
    if (this.currentIndex === 0) return 0;
    return Math.round((this._score / this.currentIndex) * 100);
  }
}
```

## Migration Strategy

### 1. Keep Schema Centralized
- All table definitions remain in `db/schema/`
- Migrations continue to work without changes
- Single source of truth for database structure

### 2. Use DbContext in Features
```typescript
// features/quiz/start-quiz/handler.ts
import { createDbContext } from '@api-db/DbContext';
import { startQuizQueries } from './queries';
import { QuizSession } from '../domain/entities/QuizSession';

export async function startQuizHandler(input: StartQuizInput) {
  const ctx = createDbContext();
  
  // Use domain entity
  const session = QuizSession.create({
    userId: input.userId,
    questionCount: input.questionCount,
  });

  // Persist using queries
  const questions = await startQuizQueries.getRandomQuestions(
    ctx, 
    input.questionCount
  );
  
  const savedSession = await startQuizQueries.createSession(ctx, {
    userId: session.userId,
    questionIds: questions.map(q => q.id),
  });

  return {
    sessionId: savedSession.id,
    firstQuestion: questions[0],
  };
}
```

### 3. Gradual Migration
- Keep existing `modules/` during transition
- Move one use case at a time to `features/`
- Update imports gradually
- Delete old code only when unused

## Performance Considerations

### 1. Connection Pooling
```typescript
// Production: 20 connections, Dev: 5 connections
const pool = postgres(process.env.DATABASE_URL!, { 
  max: process.env.NODE_ENV === 'production' ? 20 : 5 
});
```

### 2. Query Optimization
- Use proper indexes (already defined in schema)
- Leverage PostgreSQL's native features (arrays, JSONB)
- Keep queries close to use cases for better understanding

### 3. Transaction Boundaries
- Use DbContext transactions for consistency
- Keep transactions small and focused
- Avoid long-running transactions

## Security Best Practices

### 1. Parameterized Queries
- Drizzle ORM handles parameterization automatically
- Never concatenate user input into SQL strings

### 2. Row-Level Security
- Currently handled at application level
- Check user ownership in queries
- Consider PostgreSQL RLS for future

### 3. Sensitive Data
- Never log full database rows
- Exclude sensitive fields in API responses
- Use environment variables for connection strings

## Testing with DbContext

```typescript
// features/quiz/start-quiz/handler.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDbContext } from '@/test/utils';
import { startQuizHandler } from './handler';

describe('startQuizHandler', () => {
  let ctx: DbContext;

  beforeEach(async () => {
    ctx = await createTestDbContext(); // Uses test database
  });

  it('should create quiz session', async () => {
    const result = await startQuizHandler({
      userId: 'test-user',
      questionCount: 5,
    });

    expect(result.sessionId).toBeDefined();
    expect(result.firstQuestion).toBeDefined();
  });
});
```

## Key Takeaways

1. **Schema stays centralized** - Pure infrastructure concern
2. **DbContext is request-scoped** - Lightweight wrapper
3. **Features import only what they need** - Via bounded context exports
4. **Domain entities map to/from rows** - Clear separation
5. **Queries live in feature slices** - Close to use cases
6. **Gradual migration supported** - Both structures coexist