/**
 * Get question use case DTOs
 * @fileoverview Input and output types for question/get-question
 */

import type { QuestionDifficulty, QuestionStatus, QuestionType } from '../domain/entities/Question';

/**
 * Get question response type for detailed question retrieval
 */
export interface GetQuestionResponse {
  question: QuestionDto;
}

/**
 * Question DTO with full details including answer options
 */
export interface QuestionDto {
  id: string;
  version: number;
  questionText: string;
  questionType: QuestionType;
  explanation: string;
  detailedExplanation?: string;
  options: QuestionOptionDto[];
  examTypes: string[];
  categories: string[];
  difficulty: QuestionDifficulty;
  tags: string[];
  images: string[];
  isPremium: boolean;
  status: QuestionStatus;
  createdById: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Question option DTO
 */
export interface QuestionOptionDto {
  id: string;
  text: string;
  isCorrect: boolean;
}

/**
 * Get question error types for domain error mapping
 */
export interface GetQuestionError {
  code: 'VALIDATION_ERROR' | 'QUESTION_NOT_FOUND' | 'QUESTION_ACCESS_DENIED' | 'REPOSITORY_ERROR';
  message: string;
  field?: string;
}

// Note: GetQuestionRequest type is defined in validation.ts using z.infer<typeof getQuestionSchema>
// This ensures the DTO and validation schema never drift apart
