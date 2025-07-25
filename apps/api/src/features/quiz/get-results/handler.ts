/**
 * Get results handler implementation
 * @fileoverview Business logic for retrieving quiz results with scoring
 */

import { AuthorizationError, ValidationError } from '@api/shared/errors';
import { Result } from '@api/shared/result';
import type { IQuizRepository } from '../domain/repositories/IQuizRepository';
import type { QuizSessionId, UserId } from '../domain/value-objects/Ids';
import type { IQuestionDetailsService } from '../domain/value-objects/QuestionDetailsService';
import type { GetResultsResponse } from './dto';
import { buildAnswerResults, calculateScoreSummary } from './scoring-utils';
import { getResultsSchema } from './validation';

/**
 * Business logic error for session not found
 */
class SessionNotFoundError extends Error {
  constructor(sessionId: QuizSessionId) {
    super(`Quiz session not found: ${sessionId.toString()}`);
    this.name = 'SessionNotFoundError';
  }
}

/**
 * Get results use case handler
 * Retrieves quiz results with detailed scoring and answer analysis
 */
export async function getResultsHandler(
  input: Record<string, never>,
  sessionId: QuizSessionId,
  userId: UserId,
  quizRepository: IQuizRepository,
  questionDetailsService: IQuestionDetailsService
): Promise<Result<GetResultsResponse>> {
  try {
    // 1. Validate input schema (minimal for GET request)
    const validationResult = getResultsSchema.safeParse(input);
    if (!validationResult.success) {
      return Result.fail(new ValidationError(validationResult.error.message));
    }

    // 2. Load and validate session
    const sessionResult = await loadAndValidateSession(sessionId, userId, quizRepository);
    if (!sessionResult.success) {
      return Result.fail(sessionResult.error);
    }
    const session = sessionResult.data;

    // 3. Load question details
    const questionDetailsResult = await loadQuestionDetails(
      session.getQuestionIds(),
      questionDetailsService
    );
    if (!questionDetailsResult.success) {
      return Result.fail(questionDetailsResult.error);
    }
    const questionDetailsMap = questionDetailsResult.data;

    // 4. Build answer results and calculate score
    const { answerResults, correctCount } = buildAnswerResults(session, questionDetailsMap);
    const scoreSummary = calculateScoreSummary(correctCount, session.config.questionCount);

    // 5. Build response
    const response: GetResultsResponse = {
      sessionId: session.id,
      state: session.state,
      startedAt: session.startedAt,
      completedAt: session.completedAt || null,
      config: {
        examType: session.config.examType,
        category: session.config.category || undefined,
        questionCount: session.config.questionCount,
        timeLimit: session.config.timeLimit,
        difficulty: session.config.difficulty,
      },
      score: scoreSummary,
      answers: answerResults,
      canViewResults: true, // Allow viewing results for both completed and in-progress quizzes
    };

    return Result.ok(response);
  } catch (error) {
    // Handle unexpected errors
    return Result.fail(error instanceof Error ? error : new Error('Unknown error occurred'));
  }
}

/**
 * Load and validate quiz session
 * Extracted to reduce complexity
 */
async function loadAndValidateSession(
  sessionId: QuizSessionId,
  userId: UserId,
  quizRepository: IQuizRepository
): Promise<Result<NonNullable<Awaited<ReturnType<typeof quizRepository.findById>>>>> {
  try {
    const session = await quizRepository.findById(sessionId);
    if (!session) {
      return Result.fail(new SessionNotFoundError(sessionId));
    }

    // Verify session ownership (security check)
    if (session.userId !== userId) {
      return Result.fail(new AuthorizationError('Session belongs to different user'));
    }

    return Result.ok(session);
  } catch (error) {
    return Result.fail(
      new Error(
        `Failed to load quiz session: ${error instanceof Error ? error.message : String(error)}`
      )
    );
  }
}

/**
 * Load question details for scoring
 * Extracted to reduce complexity
 */
async function loadQuestionDetails(
  questionIds: Parameters<typeof questionDetailsService.getMultipleQuestionDetails>[0],
  questionDetailsService: IQuestionDetailsService
): Promise<Result<Awaited<ReturnType<typeof questionDetailsService.getMultipleQuestionDetails>>>> {
  try {
    const questionDetailsMap = await questionDetailsService.getMultipleQuestionDetails(questionIds);
    return Result.ok(questionDetailsMap);
  } catch (error) {
    return Result.fail(
      new Error(
        `Failed to load question details: ${error instanceof Error ? error.message : String(error)}`
      )
    );
  }
}
