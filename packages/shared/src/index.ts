/**
 * @certquiz/shared - Shared types and utilities for CertQuiz
 *
 * This package provides environment-agnostic types and utilities
 * that can be used in both frontend and backend code.
 *
 * Import directly from submodules:
 * - import { QUIZ_SIZES, ExamType } from '@certquiz/shared/constants'
 * - import { Result, calculateAccuracy } from '@certquiz/shared/utils'
 */

export type { ExamType, QuestionType, QuizSize, UserRole } from './constants/index';
// Export commonly used types and utilities explicitly
// Constants
export { CONFIG, EXAM_TYPES, QUESTION_TYPES, QUIZ_SIZES, USER_ROLES } from './constants/index';
// Utils - types
export type { Result } from './utils/index';
// Utils - functions and values
export {
  calculateAccuracy,
  calculateExperience,
  calculateLevel,
  err,
  generateId,
  isErr,
  isOk,
  ok,
  shuffle,
} from './utils/index';
