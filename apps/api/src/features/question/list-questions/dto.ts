/**
 * List questions use case DTOs
 * @fileoverview Input and output types for question/list-questions
 */

import type { QuestionDifficulty, QuestionType } from '../domain/entities/Question';

/**
 * List questions response type for paginated question listing
 */
export interface ListQuestionsResponse {
  questions: QuestionSummaryDto[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasNext: boolean;
  };
}

/**
 * Question summary DTO for list view (without answer details)
 */
export interface QuestionSummaryDto {
  questionId: string;
  questionText: string;
  questionType: QuestionType;
  examTypes: string[];
  categories: string[];
  difficulty: QuestionDifficulty;
  isPremium: boolean;
  hasImages: boolean;
  optionCount: number;
  tags: string[];
  createdAt: Date;
}

// Note: ListQuestionsRequest type is defined in validation.ts using z.infer<typeof listQuestionsSchema>
// This ensures the DTO and validation schema never drift apart
