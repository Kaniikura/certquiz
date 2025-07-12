/**
 * Test ID generators for domain objects
 * @fileoverview Simple ID generation functions for tests
 */

import {
  AnswerId,
  OptionId,
  QuestionId,
  QuizSessionId,
  UserId,
} from '@api/features/quiz/domain/value-objects/Ids';

/**
 * Create test IDs with optional prefixes for readability
 */
export const testIds = {
  userId: (id = 'user-123'): UserId => UserId.of(id),

  questionId: (id = 'question-123'): QuestionId => QuestionId.of(id),

  optionId: (id = 'option-123'): OptionId => OptionId.of(id),

  quizSessionId: (id = 'quiz-session-123'): QuizSessionId => QuizSessionId.of(id),

  answerId: (id = 'answer-123'): AnswerId => AnswerId.of(id),

  // Batch generators for convenience
  questionIds: (count: number, prefix = 'q'): QuestionId[] =>
    Array.from({ length: count }, (_, i) => QuestionId.of(`${prefix}${i + 1}`)),

  optionIds: (count: number, prefix = 'opt'): OptionId[] =>
    Array.from({ length: count }, (_, i) => OptionId.of(`${prefix}${i + 1}`)),
};
