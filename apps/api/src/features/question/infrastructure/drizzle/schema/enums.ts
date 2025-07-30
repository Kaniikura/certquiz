// Question feature specific enums
import { pgEnum } from 'drizzle-orm/pg-core';
import { QUESTION_DIFFICULTY_VALUES } from '../../../domain/value-objects/QuestionDifficulty';

/**
 * Question Type Database Mapping
 *
 * PostgreSQL enum 'question_type' uses simplified values for storage efficiency:
 * - 'single': Questions where only ONE answer can be selected
 * - 'multiple': Questions where MULTIPLE answers can be selected
 *
 * These map to richer domain types through QuestionRowMapper functions:
 * - 'single' → 'multiple_choice' (standard single-answer questions)
 * - 'single' → 'true_false' (special case when options are exactly ["True", "False"])
 * - 'multiple' → 'multiple_select' (checkbox-style multi-answer questions)
 *
 * Why this design?
 * - Database simplicity: Only two fundamental answer selection modes
 * - Domain expressiveness: Business logic distinguishes true/false as a special case
 * - Storage efficiency: Minimizes enum values in the database
 * - Future extensibility: New question types can map to existing DB values
 *
 * See QuestionRowMapper.ts for the mapping implementation:
 * - mapQuestionTypeToDb(): Domain → Database
 * - mapQuestionTypeFromDb(): Database → Domain (with true/false detection)
 */
const questionTypeValues = ['single', 'multiple'] as const;
export const questionTypeEnum = pgEnum('question_type', questionTypeValues);

const questionStatusValues = ['draft', 'active', 'inactive', 'archived'] as const;
export const questionStatusEnum = pgEnum('question_status', questionStatusValues);

// Difficulty enum using values from domain layer
export const difficultyEnum = pgEnum('difficulty', QUESTION_DIFFICULTY_VALUES);

// Type aliases for ergonomic usage
export type QuestionType = (typeof questionTypeValues)[number];
export type QuestionStatus = (typeof questionStatusValues)[number];
// Re-export QuestionDifficulty from domain for backward compatibility
export type { QuestionDifficulty } from '../../../domain/value-objects/QuestionDifficulty';
