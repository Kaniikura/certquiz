/**
 * @certquiz/shared - Shared types and utilities for CertQuiz
 *
 * This package provides environment-agnostic types and utilities
 * that can be used in both frontend and backend code.
 *
 * Import directly from submodules:
 * - import { QUIZ_SIZES, QuizSize } from '@certquiz/shared/constants'
 * - import { Result, calculateAccuracy } from '@certquiz/shared/utils'
 */

// Export commonly used types and utilities explicitly
// Constants
export type { QuizSize } from './constants/index';
export { CONFIG, QUIZ_SIZES } from './constants/index';

// Utils - types
export type { Result } from './utils/index';

// Utils - functions
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
