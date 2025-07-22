/**
 * Question domain barrel export
 * @fileoverview Central export point for question domain layer
 */

// Entities
export {
  Question,
  type QuestionDifficulty,
  type QuestionJSON,
  type QuestionStatus,
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
// Services
export type { IPremiumAccessService } from './services';
export { PremiumAccessService } from './services';
// Value Objects
export { QuestionOption, type QuestionOptionJSON } from './value-objects/QuestionOption';
export { QuestionOptions } from './value-objects/QuestionOptions';
