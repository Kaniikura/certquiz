/**
 * Question Service interface for quiz sessions
 * @fileoverview Service for fetching questions to include in quiz sessions
 */

import * as crypto from 'node:crypto';
import type { QuestionId } from '../domain/value-objects/Ids';

/**
 * Parameters for selecting questions for a quiz
 */
export interface QuestionSelectionParams {
  examType: string;
  category?: string;
  questionCount: number;
  difficulty?: string;
}

/**
 * Service interface for fetching questions for quiz sessions
 * This is separate from the public catalog IQuestionRepository
 */
export interface IQuestionService {
  /**
   * Get question IDs for a new quiz session
   * @param params Selection criteria
   * @returns Array of question IDs matching the criteria
   * @throws Error if insufficient questions available
   */
  getQuestionsForQuiz(params: QuestionSelectionParams): Promise<QuestionId[]>;
}

/**
 * Stub implementation for development
 * TODO: Replace with actual implementation that queries question database
 */
export class StubQuestionService implements IQuestionService {
  async getQuestionsForQuiz(params: QuestionSelectionParams): Promise<QuestionId[]> {
    // Generate mock question IDs for development
    const mockQuestions: QuestionId[] = [];

    // Create a unique seed based on params to ensure different question sets
    const seed = `${params.examType}-${params.category || 'all'}-${params.difficulty || 'mixed'}`;

    // Generate deterministic hash for consistent test IDs
    // NOTE: This is a stub implementation for development/testing.
    // In production, replace this entire StubQuestionService with a real implementation
    // that queries the question database and returns actual question IDs.
    const seedHash = crypto.createHash('sha256').update(seed).digest('hex').slice(0, 8);

    for (let i = 0; i < params.questionCount; i++) {
      // Generate unique UUIDs based on params and index for consistent testing
      const uniqueId = `${seedHash}-0000-4000-8000-${String(i).padStart(12, '0')}` as QuestionId;
      mockQuestions.push(uniqueId);
    }

    // Simulate some realistic constraints
    if (params.questionCount > 50) {
      throw new Error(
        `Insufficient questions available for ${params.examType}. Maximum 50 questions supported.`
      );
    }

    return mockQuestions;
  }
}
