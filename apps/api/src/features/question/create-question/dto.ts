/**
 * Create question use case DTOs
 * @fileoverview Input and output types for question/create-question (admin)
 */

import type { QuestionStatus, QuestionType } from '../domain/entities/Question';

/**
 * Create question response type for successful question creation
 */
export interface CreateQuestionResponse {
  question: {
    id: string;
    version: number;
    questionText: string;
    questionType: QuestionType;
    isPremium: boolean;
    status: QuestionStatus;
    createdAt: Date;
  };
}

/**
 * Question option input DTO for question creation
 */
export interface CreateQuestionOptionDto {
  id?: string; // Optional, will be generated if not provided
  text: string;
  isCorrect: boolean;
}

/**
 * Create question error types for domain error mapping
 */
export interface CreateQuestionError {
  code:
    | 'VALIDATION_ERROR'
    | 'INVALID_QUESTION_DATA'
    | 'QUESTION_ACCESS_DENIED'
    | 'REPOSITORY_ERROR';
  message: string;
  field?: string;
}

// Note: CreateQuestionRequest type is defined in validation.ts using z.infer<typeof createQuestionSchema>
// This ensures the DTO and validation schema never drift apart
