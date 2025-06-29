import {
  boolean,
  index,
  integer,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

import { categories, exams } from './exam';
import { questionOptions, questions } from './question';
import { users } from './user';

// Quiz sessions table
export const quizSessions = pgTable(
  'quiz_sessions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    examId: uuid('exam_id').references(() => exams.id, { onDelete: 'set null' }), // Optional: filter by specific exam
    categoryId: uuid('category_id').references(() => categories.id, { onDelete: 'set null' }), // Optional: filter by specific category
    questionCount: integer('question_count').notNull(),
    currentIndex: integer('current_index').notNull().default(0),
    score: integer('score'),
    isPaused: boolean('is_paused').notNull().default(false),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp('completed_at', { withTimezone: true }),
  },
  (table) => [
    index('idx_sessions_user').on(table.userId),
    index('idx_sessions_completed').on(table.completedAt),
    index('idx_sessions_exam').on(table.examId),
    index('idx_sessions_category').on(table.categoryId),
    // Composite index for active sessions
    index('idx_sessions_user_started').on(table.userId, table.startedAt),
  ]
);

// Quiz session questions (many-to-many with order)
export const sessionQuestions = pgTable(
  'session_questions',
  {
    sessionId: uuid('session_id')
      .notNull()
      .references(() => quizSessions.id, { onDelete: 'cascade' }),
    questionId: uuid('question_id')
      .notNull()
      .references(() => questions.id),
    questionOrder: integer('question_order').notNull(),
    answeredAt: timestamp('answered_at', { withTimezone: true }),
    isCorrect: boolean('is_correct'),
  },
  (table) => [
    uniqueIndex('pk_session_questions').on(table.sessionId, table.questionId),
    index('idx_session_questions_session').on(table.sessionId),
    index('idx_session_questions_question').on(table.questionId), // Added missing FK index
  ]
);

// Session selected options (normalized from array)
export const sessionSelectedOptions = pgTable(
  'session_selected_options',
  {
    sessionId: uuid('session_id')
      .notNull()
      .references(() => quizSessions.id, { onDelete: 'cascade' }),
    questionId: uuid('question_id')
      .notNull()
      .references(() => questions.id),
    optionId: uuid('option_id')
      .notNull()
      .references(() => questionOptions.id),
    selectedAt: timestamp('selected_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('pk_session_selected_options').on(
      table.sessionId,
      table.questionId,
      table.optionId
    ),
    index('idx_session_selected_session_question').on(table.sessionId, table.questionId),
    index('idx_session_selected_option').on(table.optionId),
  ]
);
