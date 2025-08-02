/**
 * Complete quiz handler implementation
 * @fileoverview Business logic for completing quizzes with atomic user progress updates
 */

import type { Clock } from '@api/shared/clock';
import { Result } from '@api/shared/result';
import type { UserId } from '../../user/domain/value-objects';
import type { IQuizCompletionService } from '../application/QuizCompletionService';
import type { QuizSessionId } from '../domain/value-objects/Ids';
import type { CompleteQuizResponse } from './dto';

/**
 * Complete quiz use case handler
 * Handles quiz completion with atomic user progress updates using application service
 */
export async function completeQuizHandler(
  sessionId: QuizSessionId,
  userId: UserId,
  quizCompletionService: IQuizCompletionService,
  _clock: Clock
): Promise<Result<CompleteQuizResponse>> {
  try {
    // Use the QuizCompletionService for atomic operation
    const completionResult = await quizCompletionService.completeQuizWithProgressUpdate(
      sessionId,
      userId
    );

    if (!completionResult.success) {
      return Result.fail(completionResult.error);
    }

    // Build API response
    const response: CompleteQuizResponse = {
      sessionId: completionResult.data.sessionId,
      finalScore: completionResult.data.finalScore,
      progressUpdate: completionResult.data.progressUpdate,
      completedAt: completionResult.data.completedAt,
    };

    return Result.ok(response);
  } catch (error) {
    // Handle unexpected errors
    return Result.fail(error instanceof Error ? error : new Error('Unknown error'));
  }
}
