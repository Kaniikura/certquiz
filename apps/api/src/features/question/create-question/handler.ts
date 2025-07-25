/**
 * Create question handler implementation
 * @fileoverview Business logic for admin question creation with validation
 */

import { QuestionId } from '@api/features/quiz/domain';
import type { Clock } from '@api/shared/clock';
import { ValidationError } from '@api/shared/errors';
import { validateAndHandle } from '@api/shared/handler';
import type { IdGenerator } from '@api/shared/id-generator';
import { Result } from '@api/shared/result';
import type { ZodSchema } from 'zod';
import { Question } from '../domain/entities/Question';
import type { IQuestionRepository } from '../domain/repositories/IQuestionRepository';
import type { QuestionOption } from '../domain/value-objects/QuestionOption';
import { QuestionOption as QuestionOptionFactory } from '../domain/value-objects/QuestionOption';
import { QuestionOptions } from '../domain/value-objects/QuestionOptions';
import { QuestionAccessDeniedError } from '../shared/errors';
import type { CreateQuestionResponse } from './dto';
import { type CreateQuestionRequest, createQuestionSchema } from './validation';

/**
 * Create question use case handler
 * Creates new question with admin authorization and validation
 */
export const createQuestionHandler = validateAndHandle(
  createQuestionSchema as ZodSchema<CreateQuestionRequest>,
  async (
    request: CreateQuestionRequest,
    questionRepository: IQuestionRepository,
    clock: Clock,
    idGenerator: IdGenerator,
    userId: string,
    userRoles: string[] = []
  ): Promise<Result<CreateQuestionResponse, Error>> => {
    // Check admin authorization
    if (!userRoles.includes('admin')) {
      return Result.fail(
        new QuestionAccessDeniedError('*', 'Admin role required to create questions')
      );
    }

    // Create and validate question options in a single pass
    const options: QuestionOption[] = [];
    for (const optionDto of request.options) {
      const optionResult = QuestionOptionFactory.create({
        id: optionDto.id || idGenerator.generate(),
        text: optionDto.text,
        isCorrect: optionDto.isCorrect,
      });

      if (!optionResult.success) {
        return Result.fail(new ValidationError(`Invalid option: ${optionResult.error.message}`));
      }

      options.push(optionResult.data);
    }
    const optionsResult = QuestionOptions.create(options);
    if (!optionsResult.success) {
      return Result.fail(
        new ValidationError(`Invalid options collection: ${optionsResult.error.message}`)
      );
    }

    // Create question entity
    const now = clock.now();
    const questionId = QuestionId.generate();

    const questionResult = Question.create({
      id: questionId,
      version: 1, // New questions start at version 1
      questionText: request.questionText,
      questionType: request.questionType,
      explanation: request.explanation,
      detailedExplanation: request.detailedExplanation,
      options: optionsResult.data,
      examTypes: request.examTypes,
      categories: request.categories,
      difficulty: request.difficulty,
      tags: request.tags,
      images: request.images,
      isPremium: request.isPremium,
      status: request.status,
      createdById: userId,
      createdAt: now,
      updatedAt: now,
    });

    if (!questionResult.success) {
      return Result.fail(
        new ValidationError(`Failed to create question: ${questionResult.error.message}`)
      );
    }

    // Save question to repository
    const createdQuestion = await questionRepository.createQuestion(questionResult.data);

    // Return creation response
    return Result.ok({
      question: {
        id: createdQuestion.id,
        version: createdQuestion.version,
        questionText: createdQuestion.questionText,
        questionType: createdQuestion.questionType,
        isPremium: createdQuestion.isPremium,
        status: createdQuestion.status,
        createdAt: createdQuestion.createdAt,
      },
    });
  }
);
