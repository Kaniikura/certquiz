// Question feature specific enums
import { pgEnum } from 'drizzle-orm/pg-core';

// Question related enums
const questionTypeValues = ['single', 'multiple'] as const;
export const questionTypeEnum = pgEnum('question_type', questionTypeValues);

const questionStatusValues = ['draft', 'active', 'inactive', 'archived'] as const;
export const questionStatusEnum = pgEnum('question_status', questionStatusValues);

// Difficulty is used in question context
const difficultyValues = ['Beginner', 'Intermediate', 'Advanced', 'Expert', 'Mixed'] as const;
export const difficultyEnum = pgEnum('difficulty', difficultyValues);

// Type aliases for ergonomic usage
export type QuestionType = (typeof questionTypeValues)[number];
export type QuestionStatus = (typeof questionStatusValues)[number];
export type QuestionDifficulty = (typeof difficultyValues)[number];
