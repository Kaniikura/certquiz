/**
 * Get question handler implementation
 * @fileoverview Business logic for retrieving detailed question information
 */

import { QuestionId } from '@api/features/quiz/domain/value-objects/Ids';
import { ValidationError } from '@api/shared/errors';
import { Result } from '@api/shared/result';
import type { IQuestionRepository } from '../domain/repositories/IQuestionRepository';
import { QuestionAccessDeniedError, QuestionNotFoundError } from '../shared/errors';
import type { GetQuestionResponse, QuestionDto, QuestionOptionDto } from './dto';
import { type GetQuestionRequest, getQuestionSchema } from './validation';

/**
 * Get question use case handler
 * Retrieves detailed question information with access control
 */
export async function getQuestionHandler(
  input: unknown,
  questionRepository: IQuestionRepository,
  isAuthenticated: boolean = false
): Promise<Result<GetQuestionResponse, Error>> {
  try {
    // 1. Validate input using Zod schema
    const validationResult = getQuestionSchema.safeParse(input);
    if (!validationResult.success) {
      return Result.fail(new ValidationError(validationResult.error.message));
    }

    const request: GetQuestionRequest = validationResult.data;
    const questionId = QuestionId.of(request.questionId);

    // 2. Retrieve question from repository
    const question = await questionRepository.findQuestionWithDetails(questionId);

    if (!question) {
      return Result.fail(new QuestionNotFoundError(questionId));
    }

    // 3. Check premium access
    if (question.isPremium && !isAuthenticated) {
      return Result.fail(
        new QuestionAccessDeniedError(
          questionId,
          'Authentication required to access premium question'
        )
      );
    }

    // 4. Transform domain entity to DTO
    const questionOptions: QuestionOptionDto[] = question.options.getAll().map((option) => ({
      id: option.id,
      text: option.text,
      isCorrect: option.isCorrect,
    }));

    const questionDto: QuestionDto = {
      id: question.id,
      version: question.version,
      questionText: question.questionText,
      questionType: question.questionType,
      explanation: question.explanation,
      detailedExplanation: question.detailedExplanation,
      options: questionOptions,
      examTypes: question.examTypes,
      categories: question.categories,
      difficulty: question.difficulty,
      tags: question.tags,
      images: question.images,
      isPremium: question.isPremium,
      status: question.status,
      createdById: question.createdById,
      createdAt: question.createdAt,
      updatedAt: question.updatedAt,
    };

    // 5. Return detailed question response
    return Result.ok({
      question: questionDto,
    });
  } catch (error) {
    // Handle unexpected errors
    return Result.fail(error instanceof Error ? error : new Error('Unknown error'));
  }
}
