import { authUser } from '@api/features/auth/infrastructure/drizzle/schema/authUser';
import { eq, inArray, sql } from 'drizzle-orm';
import {
  check,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { type QuizStateValue, quizStateEnum } from './enums';

// Event store for QuizSession aggregate (write-side)
export const quizSessionEvent = pgTable(
  'quiz_session_event',
  {
    sessionId: uuid('session_id').notNull(),
    version: integer('version').notNull().default(1), // Starts at 1, increments per command
    eventType: text('event_type').notNull(), // 'quiz.started' | 'quiz.answer_submitted' | 'quiz.completed' | 'quiz.expired'
    payload: jsonb('payload').notNull(), // Domain event payload
    occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull().defaultNow(),
    eventSequence: integer('event_sequence').notNull().default(1), // Sequence within version
  },
  (table) => [
    // Composite primary key for event sourcing and optimistic locking
    // - Ensures each event in the event store is uniquely identifiable by sessionId, version, and eventSequence.
    // - Supports optimistic locking by detecting concurrent updates to the same session/version.
    primaryKey({ columns: [table.sessionId, table.version, table.eventSequence] }),
    // Performance indexes
    index('ix_quiz_event_session_version').on(table.sessionId, table.version),
    index('ix_quiz_event_occurred').on(table.occurredAt),
    index('ix_quiz_event_type').on(table.eventType),
    // Standard index for event type and payload queries
    index('ix_quiz_event_payload').on(table.eventType, table.payload),
    // Check constraints for data integrity
    check('ck_event_sequence_positive', sql`${table.eventSequence} > 0`),
    check('ck_version_positive', sql`${table.version} > 0`),
  ]
);

export type QuizSessionEventRow = typeof quizSessionEvent.$inferSelect;

// Snapshot store for fast queries (read-side)
export const quizSessionSnapshot = pgTable(
  'quiz_session_snapshot',
  {
    sessionId: uuid('session_id').primaryKey(),
    ownerId: uuid('owner_id')
      .notNull()
      .references(() => authUser.userId, { onDelete: 'cascade' }),
    state: quizStateEnum('state').notNull(),
    questionCount: integer('question_count').notNull(),
    currentQuestionIndex: integer('current_question_index').notNull().default(0),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }), // NULL for sessions without time limit
    completedAt: timestamp('completed_at', { withTimezone: true }),
    version: integer('version').notNull(), // Mirrors last applied event version

    // Serialized domain objects for performance
    config: jsonb('config').notNull(), // QuizConfig value object
    questionOrder: uuid('question_order').array().notNull(), // Ordered question IDs
    answers: jsonb('answers'), // Map<QuestionId, Answer>

    // Metadata
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // Unique active session per user (partial index)
    uniqueIndex('ix_snapshot_active_user')
      .on(table.ownerId)
      .where(eq(table.state, 'IN_PROGRESS' satisfies QuizStateValue)),

    // Covering index for owner queries (will be created manually in migration)
    index('ix_snapshot_owner_state').on(table.ownerId, table.state),

    // Standard performance indexes
    index('ix_snapshot_owner_started').on(table.ownerId, table.startedAt),
    index('ix_snapshot_state_started').on(table.state, table.startedAt),

    // Partial index for expired sessions (for cleanup queries)
    index('ix_snapshot_expired_cleanup')
      .on(table.completedAt)
      .where(inArray(table.state, ['COMPLETED', 'EXPIRED'] satisfies QuizStateValue[])),

    // Partial index for in-progress sessions with expiry
    index('ix_snapshot_active_expiry')
      .on(table.expiresAt)
      .where(eq(table.state, 'IN_PROGRESS' satisfies QuizStateValue)),

    // Check constraints for data integrity
    check(
      'ck_session_state_consistency',
      sql`
      CASE 
        WHEN ${table.state} = ${'IN_PROGRESS' satisfies QuizStateValue} THEN ${table.expiresAt} IS NOT NULL
        WHEN ${table.state} = ${'COMPLETED' satisfies QuizStateValue} THEN ${table.completedAt} IS NOT NULL
        WHEN ${table.state} = ${'EXPIRED' satisfies QuizStateValue} THEN ${table.completedAt} IS NOT NULL
        ELSE true
      END
    `
    ),
    check(
      'ck_question_index_bounds',
      sql`${table.currentQuestionIndex} >= 0 AND ${table.currentQuestionIndex} < ${table.questionCount}`
    ),
  ]
);
