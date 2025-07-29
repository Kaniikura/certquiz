/**
 * QuestionDifficulty value object
 * @fileoverview Domain value object representing the difficulty level of a question
 */

/**
 * Valid difficulty levels for questions
 * These represent the supported difficulty levels in the certification exam system
 */
export const QUESTION_DIFFICULTY_VALUES = [
  'Beginner',
  'Intermediate',
  'Advanced',
  'Expert',
  'Mixed',
] as const;

/**
 * QuestionDifficulty type representing the difficulty level of a question
 */
export type QuestionDifficulty = (typeof QUESTION_DIFFICULTY_VALUES)[number];

/**
 * Type guard to check if a value is a valid QuestionDifficulty
 */
export function isQuestionDifficulty(value: unknown): value is QuestionDifficulty {
  return (
    typeof value === 'string' && QUESTION_DIFFICULTY_VALUES.includes(value as QuestionDifficulty)
  );
}

/**
 * Get all valid question difficulty values
 */
export function getQuestionDifficultyValues(): readonly QuestionDifficulty[] {
  return QUESTION_DIFFICULTY_VALUES;
}
