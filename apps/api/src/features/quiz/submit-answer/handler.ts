/**
 * Submit answer handler implementation
 * @fileoverview Business logic for submitting answers to quiz questions
 */

import type { Clock } from '@api/shared/clock';
import { AuthorizationError, ValidationError } from '@api/shared/errors';
import { Result } from '@api/shared/result';
import type { QuizSession } from '../domain/aggregates/QuizSession';
import type { IQuizRepository } from '../domain/repositories/IQuizRepository';
import { OptionId, QuestionId, type QuizSessionId, type UserId } from '../domain/value-objects/Ids';
import type { QuestionReference } from '../domain/value-objects/QuestionReference';
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
 * Load question reference with error handling
 */
async function loadQuestionReference(
  questionService: IQuestionService,
  questionId: QuestionId
): Promise<Result<QuestionReference>> {
  try {
    const questionReference = await questionService.getQuestionReference(questionId);
    if (!questionReference) {
      return Result.fail(new QuestionNotFoundError(questionId));
    }
    return Result.ok(questionReference);
  } catch (error) {
    return Result.fail(
      new Error(
        `Failed to load question reference: ${error instanceof Error ? error.message : String(error)}`
      )
    );
  }
}

/**
 * Check if quiz was auto-completed
 */
function checkAutoCompletion(session: QuizSession): boolean {
  return (
    session.state === QuizState.Completed &&
    session.config.autoCompleteWhenAllAnswered &&
    session.getAnsweredQuestionCount() === session.config.questionCount
  );
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
    const questionRefResult = await loadQuestionReference(questionService, questionId);
    if (!questionRefResult.success) {
      return Result.fail(questionRefResult.error);
    }

    // 6. Submit answer using domain logic
    const submitResult = session.submitAnswer(
      questionId,
      selectedOptionIds,
      questionRefResult.data,
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
    const wasAutoCompleted = checkAutoCompletion(session);

    // 9. Calculate current question index (position of this question in the ordered list)
    const questionIds = session.getQuestionIds();
    const currentQuestionIndex = questionIds.findIndex((qId) => QuestionId.equals(qId, questionId));

    // Validate we found the question (should always succeed since we validated earlier)
    if (currentQuestionIndex === -1) {
      throw new Error(
        `Question ${QuestionId.toString(questionId)} not found in session question list`
      );
    }

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
