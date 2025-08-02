/**
 * Start quiz handler implementation
 * @fileoverview Business logic for creating new quiz sessions
 */

import type { Clock } from '@api/shared/clock';
import { getErrorMessage } from '@api/shared/error/error-utils';
import { ValidationError } from '@api/shared/errors';
import { Result } from '@api/shared/result';
import { QuizSession } from '../domain/aggregates/QuizSession';
import type { IQuizRepository } from '../domain/repositories/IQuizRepository';
import type { Category, Difficulty, ExamType } from '../domain/value-objects/ExamTypes';
import type { UserId } from '../domain/value-objects/Ids';
import { QuizConfig } from '../domain/value-objects/QuizConfig';
import type { StartQuizRequest, StartQuizResponse } from './dto';
import type { IQuestionService } from './QuestionService';
import { startQuizSchema } from './validation';

/**
 * Business logic error for quiz session conflicts
 */
class ActiveSessionError extends Error {
  constructor() {
    super(
      'User already has an active session. Complete or abandon current session before starting a new one.'
    );
    this.name = 'ActiveSessionError';
  }
}

/**
 * Business logic error for insufficient questions
 */
class InsufficientQuestionsError extends Error {
  constructor(requested: number, available: number) {
    super(`Insufficient questions available. Requested: ${requested}, Available: ${available}`);
    this.name = 'InsufficientQuestionsError';
  }
}

/**
 * Start quiz use case handler
 * Creates a new quiz session with domain validation and business rules
 */
export async function startQuizHandler(
  input: unknown,
  userId: UserId,
  quizRepository: IQuizRepository,
  questionService: IQuestionService,
  clock: Clock
): Promise<Result<StartQuizResponse>> {
  try {
    // 1. Validate input schema
    const validationResult = startQuizSchema.safeParse(input);
    if (!validationResult.success) {
      return Result.fail(new ValidationError(validationResult.error.message));
    }

    const request = validationResult.data as StartQuizRequest;

    // 2. Check business rule: no active sessions allowed
    const activeSession = await quizRepository.findActiveByUser(userId);
    if (activeSession) {
      return Result.fail(new ActiveSessionError());
    }

    // 3. Create quiz configuration with domain validation
    const configResult = QuizConfig.create({
      examType: request.examType as ExamType,
      category: request.category as Category | undefined,
      questionCount: request.questionCount,
      timeLimit: request.timeLimit,
      difficulty: request.difficulty as Difficulty | undefined,
      enforceSequentialAnswering: request.enforceSequentialAnswering,
      requireAllAnswers: request.requireAllAnswers,
      autoCompleteWhenAllAnswered: request.autoCompleteWhenAllAnswered,
      fallbackLimitSeconds: request.fallbackLimitSeconds,
    });

    if (!configResult.success) {
      return Result.fail(new ValidationError(configResult.error.message));
    }

    const config = configResult.data;

    // 4. Fetch questions from question service
    let questionIds: Awaited<ReturnType<typeof questionService.getQuestionsForQuiz>>;
    try {
      questionIds = await questionService.getQuestionsForQuiz({
        examType: request.examType,
        category: request.category,
        questionCount: request.questionCount,
        difficulty: request.difficulty,
      });
    } catch (error) {
      return Result.fail(new Error(`Failed to fetch questions: ${getErrorMessage(error)}`));
    }

    // 5. Validate question availability
    if (questionIds.length < request.questionCount) {
      return Result.fail(new InsufficientQuestionsError(request.questionCount, questionIds.length));
    }

    // 6. Create quiz session using domain factory
    const sessionResult = QuizSession.startNew(userId, config, questionIds, clock);
    if (!sessionResult.success) {
      return Result.fail(sessionResult.error);
    }

    const session = sessionResult.data;

    // 7. Persist the session
    try {
      await quizRepository.save(session);
    } catch (error) {
      return Result.fail(new Error(`Failed to save quiz session: ${getErrorMessage(error)}`));
    }

    // 8. Calculate expiration time
    const startTime = session.startedAt;
    const expiresAt = config.timeLimit
      ? new Date(startTime.getTime() + config.timeLimit * 1000)
      : new Date(startTime.getTime() + config.fallbackLimitSeconds * 1000);

    // 9. Build response
    const response: StartQuizResponse = {
      sessionId: session.id,
      config: config.toDTO(),
      questionIds: session.getQuestionIds(),
      startedAt: session.startedAt,
      expiresAt: expiresAt,
      state: session.state,
      currentQuestionIndex: 0,
      totalQuestions: config.questionCount,
    };

    return Result.ok(response);
  } catch (error) {
    // Handle unexpected errors
    return Result.fail(error instanceof Error ? error : new Error('Unknown error occurred'));
  }
}
