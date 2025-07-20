/**
 * Submit answer handler implementation
 * @fileoverview Business logic for submitting answers to quiz questions
 */

import type { Clock } from '@api/shared/clock';
import { AuthorizationError, ValidationError } from '@api/shared/errors';
import { Result } from '@api/shared/result';
import type { IQuizRepository } from '../domain/repositories/IQuizRepository';
import { OptionId, QuestionId, type QuizSessionId, type UserId } from '../domain/value-objects/Ids';
import { QuizState } from '../domain/value-objects/QuizState';
import type { SubmitAnswerRequest, SubmitAnswerResponse } from './dto';
import type { IQuestionService } from './QuestionService';
import { submitAnswerSchema } from './validation';

/**
 * Business logic error for session not found
 */
export class SessionNotFoundError extends Error {
  constructor(sessionId: QuizSessionId) {
    super(`Quiz session not found: ${sessionId.toString()}`);
    this.name = 'SessionNotFoundError';
  }
}

/**
 * Business logic error for question not found in service
 */
export class QuestionNotFoundError extends Error {
  constructor(questionId: QuestionId) {
    super(`Question not found: ${questionId.toString()}`);
    this.name = 'QuestionNotFoundError';
  }
}

/**
 * Submit answer use case handler
 * Submits an answer to a quiz question with domain validation and business rules
 */
export async function submitAnswerHandler(
  input: unknown,
  sessionId: QuizSessionId,
  userId: UserId,
  quizRepository: IQuizRepository,
  questionService: IQuestionService,
  clock: Clock
): Promise<Result<SubmitAnswerResponse>> {
  try {
    // 1. Validate input schema
    const validationResult = submitAnswerSchema.safeParse(input);
    if (!validationResult.success) {
      return Result.fail(new ValidationError(validationResult.error.message));
    }

    const request = validationResult.data as SubmitAnswerRequest;

    // 2. Convert string IDs to domain types
    const questionId = QuestionId.of(request.questionId);
    const selectedOptionIds = request.selectedOptionIds.map((id) => OptionId.of(id));

    // 3. Load quiz session
    const session = await quizRepository.findById(sessionId);
    if (!session) {
      return Result.fail(new SessionNotFoundError(sessionId));
    }

    // 4. Verify session ownership (security check)
    if (session.userId !== userId) {
      return Result.fail(new AuthorizationError('Session belongs to different user'));
    }

    // 5. Load question reference for validation
    let questionReference: Awaited<ReturnType<typeof questionService.getQuestionReference>>;
    try {
      questionReference = await questionService.getQuestionReference(questionId);
      if (!questionReference) {
        return Result.fail(new QuestionNotFoundError(questionId));
      }
    } catch (error) {
      return Result.fail(
        new Error(
          `Failed to load question reference: ${error instanceof Error ? error.message : String(error)}`
        )
      );
    }

    // 6. Submit answer using domain logic
    const submitResult = session.submitAnswer(
      questionId,
      selectedOptionIds,
      questionReference,
      clock
    );
    if (!submitResult.success) {
      return Result.fail(submitResult.error);
    }

    // 7. Persist the updated session
    try {
      await quizRepository.save(session);
    } catch (error) {
      return Result.fail(
        new Error(
          `Failed to save quiz session: ${error instanceof Error ? error.message : String(error)}`
        )
      );
    }

    // 8. Determine if auto-completed
    const wasAutoCompleted =
      session.state === QuizState.Completed &&
      session.config.autoCompleteWhenAllAnswered &&
      session.getAnsweredQuestionCount() === session.config.questionCount;

    // 9. Calculate current question index
    const currentQuestionIndex = session.getAnsweredQuestionCount() - 1; // 0-based index of last answered

    // 10. Build response
    const response: SubmitAnswerResponse = {
      sessionId: session.id,
      questionId: questionId,
      selectedOptionIds: selectedOptionIds,
      submittedAt: clock.now(),
      state: session.state,
      autoCompleted: wasAutoCompleted,
      currentQuestionIndex: currentQuestionIndex,
      totalQuestions: session.config.questionCount,
      questionsAnswered: session.getAnsweredQuestionCount(),
    };

    return Result.ok(response);
  } catch (error) {
    // Handle unexpected errors
    return Result.fail(error instanceof Error ? error : new Error('Unknown error occurred'));
  }
}
