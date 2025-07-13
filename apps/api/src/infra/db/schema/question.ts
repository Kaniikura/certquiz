// Question bounded context schema - Versioned catalog

import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { difficultyEnum, questionStatusEnum, questionTypeEnum } from './enums';
import { authUser } from './user';

// Question master table
export const question = pgTable(
  'question',
  {
    questionId: uuid('question_id').primaryKey(),
    currentVersion: integer('current_version').notNull().default(1),
    createdById: uuid('created_by_id')
      .notNull()
      .references(() => authUser.userId),
    isUserGenerated: boolean('is_user_generated').notNull().default(false),
    isPremium: boolean('is_premium').notNull().default(false),
    status: questionStatusEnum('status').notNull().default('active'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('ix_question_status_active')
      .on(table.status, table.updatedAt)
      .where(sql`status = 'active'`),
    index('ix_question_created_by').on(table.createdById, table.createdAt),
    index('ix_question_premium').on(table.isPremium, table.status),
  ]
);

export type QuestionRow = typeof question.$inferSelect;
export type NewQuestionRow = typeof question.$inferInsert;

// Question versions for immutability
export const questionVersion = pgTable(
  'question_version',
  {
    questionId: uuid('question_id')
      .notNull()
      .references(() => question.questionId, { onDelete: 'cascade' }),
    version: integer('version').notNull(),
    questionText: text('question_text').notNull(),
    questionType: questionTypeEnum('question_type').notNull(),
    explanation: text('explanation').notNull(),
    detailedExplanation: text('detailed_explanation'),
    images: text('images').array().default(sql`'{}'`),
    tags: text('tags').array().notNull().default(sql`'{}'`),

    // JSONB for options to avoid separate table
    options: jsonb('options').notNull(), // [{"id": "uuid", "text": "...", "isCorrect": true}]

    // Exam/category associations
    examTypes: text('exam_types').array().notNull().default(sql`'{}'`),
    categories: text('categories').array().notNull().default(sql`'{}'`),
    difficulty: difficultyEnum('difficulty').notNull().default('Mixed'),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('pk_question_version').on(table.questionId, table.version),
    index('ix_question_version_current').on(table.questionId, table.version),

    // Full-text search on question content
    index('ix_question_text_search').on(sql`to_tsvector('english', ${table.questionText})`),

    // GIN indexes for array searches
    index('ix_question_tags').on(table.tags),
    index('ix_question_exam_types').on(table.examTypes),
    index('ix_question_categories').on(table.categories),

    // GIN index for JSONB options queries
    index('ix_question_options_gin').using('gin', table.options),

    // Performance index for question listing queries
    index('ix_question_type_difficulty').on(table.questionType, table.difficulty),

    // Check constraints for data integrity
    check('ck_options_min_count', sql`jsonb_array_length(options) >= 2`),
    check('ck_has_correct_answer', sql`options::text LIKE '%"isCorrect":true%'`),
  ]
);

export type QuestionVersionRow = typeof questionVersion.$inferSelect;
export type NewQuestionVersionRow = typeof questionVersion.$inferInsert;

// Bookmarks for user question management
export const bookmarks = pgTable(
  'bookmarks',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => authUser.userId, { onDelete: 'cascade' }),
    questionId: uuid('question_id')
      .notNull()
      .references(() => question.questionId, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('pk_bookmarks').on(table.userId, table.questionId),
    index('ix_bookmarks_user').on(table.userId),
  ]
);

export type BookmarkRow = typeof bookmarks.$inferSelect;
export type NewBookmarkRow = typeof bookmarks.$inferInsert;
