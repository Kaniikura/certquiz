/**
 * Question details service interface for get-results
 * @fileoverview Service for loading question details including correct answers
 */

import { OptionId, type QuestionId } from '../domain/value-objects/Ids';

/**
 * Detailed question information including correct answers
 */
export interface QuestionDetails {
  id: QuestionId;
  text: string;
  options: QuestionOption[];
  correctOptionIds: OptionId[];
}

/**
 * Question option with details
 */
export interface QuestionOption {
  id: OptionId;
  text: string;
  isCorrect: boolean;
}

/**
 * Service interface for question details operations
 */
export interface IQuestionDetailsService {
  /**
   * Load question details including correct answers for scoring
   */
  getQuestionDetails(questionId: QuestionId): Promise<QuestionDetails | null>;

  /**
   * Load multiple question details efficiently
   */
  getMultipleQuestionDetails(questionIds: QuestionId[]): Promise<Map<QuestionId, QuestionDetails>>;
}

/**
 * Stub implementation for development
 * TODO: Replace with real implementation that queries question database
 */
export class StubQuestionDetailsService implements IQuestionDetailsService {
  async getQuestionDetails(questionId: QuestionId): Promise<QuestionDetails | null> {
    // Return mock question details for testing
    const options: QuestionOption[] = [
      {
        id: OptionId.of(`${questionId.toString()}-opt1`),
        text: `Option A for ${questionId.toString()}`,
        isCorrect: true, // First option is correct in our mock
      },
      {
        id: OptionId.of(`${questionId.toString()}-opt2`),
        text: `Option B for ${questionId.toString()}`,
        isCorrect: false,
      },
      {
        id: OptionId.of(`${questionId.toString()}-opt3`),
        text: `Option C for ${questionId.toString()}`,
        isCorrect: false,
      },
      {
        id: OptionId.of(`${questionId.toString()}-opt4`),
        text: `Option D for ${questionId.toString()}`,
        isCorrect: false,
      },
    ];

    const correctOptions = options.filter((opt) => opt.isCorrect).map((opt) => opt.id);

    return {
      id: questionId,
      text: `Sample question text for ${questionId.toString()}`,
      options,
      correctOptionIds: correctOptions,
    };
  }

  async getMultipleQuestionDetails(
    questionIds: QuestionId[]
  ): Promise<Map<QuestionId, QuestionDetails>> {
    const results = new Map<QuestionId, QuestionDetails>();

    for (const questionId of questionIds) {
      const details = await this.getQuestionDetails(questionId);
      if (details) {
        results.set(questionId, details);
      }
    }

    return results;
  }
}
