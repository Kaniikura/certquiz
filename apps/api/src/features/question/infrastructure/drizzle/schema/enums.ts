// Question feature specific enums
import { pgEnum } from 'drizzle-orm/pg-core';
import { QUESTION_DIFFICULTY_VALUES } from '../../../domain/value-objects/QuestionDifficulty';

// Question related enums
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
