/**
 * Question service interface for submit-answer
 * @fileoverview Service for loading question references and validation data
 */

import { OptionId, type QuestionId } from '../domain/value-objects/Ids';
import { QuestionReference } from '../domain/value-objects/QuestionReference';

/**
 * Service interface for question-related operations
 */
export interface IQuestionService {
  /**
   * Load a question reference with valid option IDs for validation
   */
  getQuestionReference(questionId: QuestionId): Promise<QuestionReference | null>;
}

/**
 * Stub implementation for development
 * TODO: Replace with real implementation that queries question database
 */
export class StubQuestionService implements IQuestionService {
  async getQuestionReference(questionId: QuestionId): Promise<QuestionReference | null> {
    // Return mock question reference for testing
    const validOptionIds = [
      OptionId.of(`${questionId.toString()}-opt1`),
      OptionId.of(`${questionId.toString()}-opt2`),
      OptionId.of(`${questionId.toString()}-opt3`),
      OptionId.of(`${questionId.toString()}-opt4`),
    ];

    return new QuestionReference(questionId, validOptionIds);
  }
}
