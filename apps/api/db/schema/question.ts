import { sql } from 'drizzle-orm';
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { questionStatusEnum, questionTypeEnum } from './enums';
import { categories, exams } from './exam';
import { users } from './user';

// Questions table
export const questions = pgTable(
  'questions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tags: text('tags').array().notNull().default([]),
    questionText: text('question_text').notNull(),
    type: questionTypeEnum('type').notNull(),
    explanation: text('explanation').notNull(),
    detailedExplanation: text('detailed_explanation'),
    images: text('images').array().default([]),
    createdById: uuid('created_by_id')
      .notNull()
      .references(() => users.id),
    createdByName: text('created_by_name'),
    isUserGenerated: boolean('is_user_generated').notNull().default(false),
    isPremium: boolean('is_premium').notNull().default(false),
    status: questionStatusEnum('status').notNull().default('active'),
    version: integer('version').notNull().default(1),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_questions_status').on(table.status),
    index('idx_questions_created_by').on(table.createdById),
    index('idx_questions_tags_gin').using('gin', table.tags),
    // Partial index for active questions only
    index('idx_active_questions')
      .on(table.status)
      .where(sql`status = 'active'`),
  ]
);

// Question options table
export const questionOptions = pgTable(
  'question_options',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    questionId: uuid('question_id')
      .notNull()
      .references(() => questions.id, { onDelete: 'cascade' }),
    text: text('text').notNull(),
    isCorrect: boolean('is_correct').notNull().default(false),
    displayOrder: integer('display_order').notNull().default(0), // Renamed from 'order'
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_options_question').on(table.questionId),
    // Ensure unique display order per question
    uniqueIndex('unq_question_display_order').on(table.questionId, table.displayOrder),
  ]
);

// Question-Exam junction table (many-to-many)
export const questionExams = pgTable(
  'question_exams',
  {
    questionId: uuid('question_id')
      .notNull()
      .references(() => questions.id, { onDelete: 'cascade' }),
    examId: uuid('exam_id')
      .notNull()
      .references(() => exams.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('pk_question_exams').on(table.questionId, table.examId),
    index('idx_question_exams_question').on(table.questionId), // Added missing FK index
    index('idx_question_exams_exam').on(table.examId),
  ]
);

// Question-Category junction table (many-to-many)
export const questionCategories = pgTable(
  'question_categories',
  {
    questionId: uuid('question_id')
      .notNull()
      .references(() => questions.id, { onDelete: 'cascade' }),
    categoryId: uuid('category_id')
      .notNull()
      .references(() => categories.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('pk_question_categories').on(table.questionId, table.categoryId),
    index('idx_question_categories_question').on(table.questionId), // Added missing FK index
    index('idx_question_categories_category').on(table.categoryId),
  ]
);

// Question bookmarks table
export const bookmarks = pgTable(
  'bookmarks',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    questionId: uuid('question_id')
      .notNull()
      .references(() => questions.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('pk_bookmarks').on(table.userId, table.questionId),
    index('idx_bookmarks_user').on(table.userId),
  ]
);

// Question history table (for versioning)
export const questionHistory = pgTable(
  'question_history',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    questionId: uuid('question_id')
      .notNull()
      .references(() => questions.id),
    version: integer('version').notNull(),
    changes: jsonb('changes').notNull(), // JSON diff of changes
    editedById: uuid('edited_by_id')
      .notNull()
      .references(() => users.id),
    editedAt: timestamp('edited_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex('idx_history_question_version').on(table.questionId, table.version)]
);
