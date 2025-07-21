/**
 * List questions handler implementation
 * @fileoverview Business logic for retrieving paginated question lists with filtering
 */

import { ValidationError } from '@api/shared/errors';
import { Result } from '@api/shared/result';
import type { QuestionDifficulty } from '../domain/entities/Question';
import type { IQuestionRepository } from '../domain/repositories/IQuestionRepository';
import type { ListQuestionsResponse, QuestionSummaryDto } from './dto';
import { type ListQuestionsRequest, listQuestionsSchema } from './validation';

/**
 * Valid QuestionDifficulty enum values
 */
const VALID_DIFFICULTIES: readonly QuestionDifficulty[] = [
  'Beginner',
  'Intermediate',
  'Advanced',
  'Mixed',
];

/**
 * Validates and safely converts a string to QuestionDifficulty
 * @param difficulty - The difficulty value to validate
 * @returns Valid QuestionDifficulty or default 'Mixed' for invalid values
 */
function validateDifficulty(difficulty: string): QuestionDifficulty {
  if (VALID_DIFFICULTIES.includes(difficulty as QuestionDifficulty)) {
    return difficulty as QuestionDifficulty;
  }
  // Silently default to 'Mixed' for invalid values
  // Note: Invalid values indicate data corruption and should be investigated
  return 'Mixed';
}

/**
 * List questions use case handler
 * Retrieves paginated list of questions with filtering support
 */
export async function listQuestionsHandler(
  input: unknown,
  questionRepository: IQuestionRepository,
  isAuthenticated: boolean = false
): Promise<Result<ListQuestionsResponse, Error>> {
  try {
    // 1. Validate input using Zod schema
    const validationResult = listQuestionsSchema.safeParse(input);
    if (!validationResult.success) {
      return Result.fail(new ValidationError(validationResult.error.message));
    }

    const request: ListQuestionsRequest = validationResult.data;

    // 2. Determine premium access based on authentication
    // Only authenticated users can access premium questions
    // If unauthenticated user requests premium, silently ignore and return only non-premium
    const includePremium = isAuthenticated && request.includePremium;

    // 3. Build repository filters from request
    const filters = {
      activeOnly: request.activeOnly,
      includePremium,
      examTypes: request.examTypes,
      categories: request.categories,
      difficulty: request.difficulty,
      searchQuery: request.searchQuery,
    };

    const pagination = {
      limit: request.limit,
      offset: request.offset,
    };

    // 4. Retrieve questions from repository
    const result = await questionRepository.findQuestions(filters, pagination);

    // 5. Transform repository response to DTO
    const questionDtos: QuestionSummaryDto[] = result.questions.map((summary) => ({
      questionId: summary.questionId,
      questionText: summary.questionText,
      questionType: summary.questionType,
      examTypes: summary.examTypes,
      categories: summary.categories,
      difficulty: validateDifficulty(summary.difficulty),
      isPremium: summary.isPremium,
      hasImages: summary.hasImages,
      optionCount: summary.optionCount,
      tags: summary.tags,
      createdAt: summary.createdAt,
    }));

    // 6. Return paginated response
    return Result.ok({
      questions: questionDtos,
      pagination: result.pagination,
    });
  } catch (error) {
    // Handle unexpected errors
    return Result.fail(error instanceof Error ? error : new Error('Unknown error'));
  }
}
