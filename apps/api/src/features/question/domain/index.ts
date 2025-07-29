/**
 * Question domain barrel export
 * @fileoverview Central export point for question domain layer
 */

// Entities
export {
  Question,
  QuestionStatus,
  type QuestionType,
} from './entities/Question';
// Repository Interface
export type {
  IQuestionRepository,
  PaginatedQuestions,
  QuestionFilters,
  QuestionPagination,
  QuestionSummary,
} from './repositories/IQuestionRepository';
export type { IPremiumAccessService } from './services';
// Services
export { PremiumAccessService } from './services';
export {
  getQuestionDifficultyValues,
  isQuestionDifficulty,
  QUESTION_DIFFICULTY_VALUES,
  type QuestionDifficulty,
} from './value-objects/QuestionDifficulty';
// Value Objects
export { QuestionOption, type QuestionOptionJSON } from './value-objects/QuestionOption';
export { QuestionOptions } from './value-objects/QuestionOptions';
