/**
 * Quiz Completion Application Service
 * @fileoverview Handles atomic quiz completion with user progress updates using Unit of Work pattern
 */
import type { UserId } from '@api/features/auth/domain/value-objects/UserId';
import type { Clock } from '@api/shared/clock';
import { AuthorizationError } from '@api/shared/errors';
import { Result } from '@api/shared/result';
import { QUIZ_REPO_TOKEN, USER_REPO_TOKEN } from '@api/shared/types/RepositoryToken';
import type { IUnitOfWorkProvider } from '../../../infra/db/IUnitOfWorkProvider';
import type { IUserRepository } from '../../user/domain/repositories/IUserRepository';
import { UserNotFoundError } from '../../user/shared/errors';
import type { IQuizRepository } from '../domain/repositories/IQuizRepository';
import type { QuizSessionId } from '../domain/value-objects/Ids';
import type { IQuestionDetailsService } from '../domain/value-objects/QuestionDetailsService';
import { QuizState } from '../domain/value-objects/QuizState';
import { buildAnswerResults, calculateScoreSummary } from '../get-results/scoring-utils';
import { QuizNotCompletedError, SessionNotFoundError } from '../shared/errors';

/**
 * Result of quiz completion operation
 */
export interface QuizCompletionResult {
  sessionId: QuizSessionId;
  finalScore: number;
  completedAt: Date;
  progressUpdate: {
    previousLevel: number;
    newLevel: number;
    experienceGained: number;
  };
}

/**
 * Interface for Quiz Completion Service
 */
export interface IQuizCompletionService {
  completeQuizWithProgressUpdate(
    sessionId: QuizSessionId,
    userId: UserId
  ): Promise<Result<QuizCompletionResult>>;
}

/**
 * Application service for quiz completion with atomic user progress updates
 *
 * This service handles the complex business operation of completing a quiz
 * and updating user progress within a single transaction to ensure data consistency.
 *
 * Key responsibilities:
 * - Validate quiz session ownership and completion state
 * - Calculate quiz results using domain logic
 * - Update user progress using domain logic
 * - Ensure atomic operation across Quiz and User aggregates
 */
export class QuizCompletionService implements IQuizCompletionService {
  constructor(
    private readonly unitOfWorkProvider: IUnitOfWorkProvider,
    private readonly questionDetailsService: IQuestionDetailsService,
    private readonly clock: Clock
  ) {}

  /**
   * Complete a quiz and update user progress atomically
   *
   * This operation involves two aggregates (QuizSession and User) and must be
   * executed within a single transaction to maintain data consistency.
   *
   * @param sessionId - ID of the quiz session to complete
   * @param userId - ID of the user completing the quiz
   * @returns Promise<Result<QuizCompletionResult>> - Completion result with progress update
   */
  async completeQuizWithProgressUpdate(
    sessionId: QuizSessionId,
    userId: UserId
  ): Promise<Result<QuizCompletionResult>> {
    try {
      return await this.unitOfWorkProvider.execute(async (unitOfWork) => {
        // 1. Get repositories within Unit of Work transaction
        const quizRepo = unitOfWork.getRepository(QUIZ_REPO_TOKEN) as IQuizRepository;
        const userRepo = unitOfWork.getRepository(USER_REPO_TOKEN) as IUserRepository;

        // 2. Load quiz session and validate
        const session = await quizRepo.findById(sessionId);
        if (!session) {
          return Result.fail(
            new SessionNotFoundError(`Quiz session not found: ${sessionId.toString()}`)
          );
        }

        // 3. Verify session ownership (security check)
        if (session.userId !== userId) {
          return Result.fail(new AuthorizationError('Session belongs to different user'));
        }

        // 4. Verify session is in completed state
        if (session.state !== QuizState.Completed) {
          return Result.fail(new QuizNotCompletedError(sessionId.toString(), session.state));
        }

        // 5. Load user and validate
        const user = await userRepo.findById(userId);
        if (!user) {
          return Result.fail(new UserNotFoundError(userId.toString()));
        }

        // 6. Calculate quiz results using existing scoring utilities
        const questionIds = session.getQuestionIds();
        const questionDetailsMap =
          await this.questionDetailsService.getMultipleQuestionDetails(questionIds);

        const { correctCount } = buildAnswerResults(session, questionDetailsMap);
        const scoreSummary = calculateScoreSummary(correctCount, session.config.questionCount);

        // 7. Capture previous state for progress tracking
        const previousLevel = user.progress.level.value;
        const previousExperience = user.progress.experience.value;

        // 8. Calculate study time from session start to completion
        const studyTimeMinutes = session.completedAt
          ? Math.ceil((session.completedAt.getTime() - session.startedAt.getTime()) / (1000 * 60))
          : 0;

        // 9. Update user progress using domain logic
        const updatedUser = user.completeQuiz(
          {
            correctAnswers: scoreSummary.correctAnswers,
            totalQuestions: scoreSummary.totalQuestions,
            category: session.config.getCategory(),
            studyTimeMinutes,
          },
          this.clock
        );

        // 10. Save both aggregates atomically within Unit of Work
        await quizRepo.save(session);
        await userRepo.updateProgress(updatedUser);

        // 11. Return completion result
        const completionResult: QuizCompletionResult = {
          sessionId: session.id,
          finalScore: scoreSummary.percentage,
          completedAt: session.completedAt || this.clock.now(),
          progressUpdate: {
            previousLevel,
            newLevel: updatedUser.progress.level.value,
            experienceGained: updatedUser.progress.experience.value - previousExperience,
          },
        };

        return Result.ok(completionResult);
      });
    } catch (error) {
      // Handle unexpected errors
      return Result.fail(
        error instanceof Error ? error : new Error('Unknown error occurred during quiz completion')
      );
    }
  }
}
