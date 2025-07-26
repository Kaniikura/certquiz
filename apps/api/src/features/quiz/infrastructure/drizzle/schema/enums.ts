// Quiz feature specific enums
import { pgEnum } from 'drizzle-orm/pg-core';

// Quiz related enums
const quizStateValues = ['IN_PROGRESS', 'COMPLETED', 'EXPIRED'] as const;
export const quizStateEnum = pgEnum('quiz_state', quizStateValues);

// Strongly-typed union for quiz state values
export type QuizStateValue = (typeof quizStateValues)[number];
