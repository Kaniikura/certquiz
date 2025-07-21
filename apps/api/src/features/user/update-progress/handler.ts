/**
 * Update progress handler implementation
 * @fileoverview Business logic for updating user progress after quiz completion
 */

import type { Clock } from '@api/shared/clock';
import { ValidationError } from '@api/shared/errors';
import { Result } from '@api/shared/result';
import type { IUserRepository } from '../domain/repositories/IUserRepository';
import { UserId } from '../domain/value-objects';
import type { UpdateProgressResponse } from './dto';
import { updateProgressSchema } from './validation';

/**
 * Custom errors for update progress use case
 */
export class UserNotFoundError extends Error {
  constructor(userId: string) {
    super(`User with ID ${userId} not found`);
    this.name = 'UserNotFoundError';
  }
}

/**
 * Update progress use case handler
 * Updates user progress based on quiz completion
 */
export async function updateProgressHandler(
  input: unknown,
  userRepository: IUserRepository,
  clock: Clock
): Promise<Result<UpdateProgressResponse, Error>> {
  try {
    // 1. Validate input using Zod schema
    const validationResult = updateProgressSchema.safeParse(input);
    if (!validationResult.success) {
      return Result.fail(new ValidationError(validationResult.error.message));
    }

    const { userId, correctAnswers, totalQuestions, category, studyTimeMinutes } =
      validationResult.data;

    // 2. Find user by ID
    const userIdValue = UserId.of(userId);
    const user = await userRepository.findById(userIdValue);
    if (!user) {
      return Result.fail(new UserNotFoundError(userId));
    }

    // 3. Update user progress using domain method
    const updatedUser = user.completeQuiz(
      {
        correctAnswers,
        totalQuestions,
        category,
        studyTimeMinutes,
      },
      clock
    );

    // 4. Save updated user
    await userRepository.updateProgress(updatedUser);

    // 5. Return progress data
    const categoryStats: {
      [category: string]: { correct: number; total: number; accuracy: number };
    } = {};
    for (const cat of updatedUser.progress.categoryStats.getAllCategories()) {
      const stats = updatedUser.progress.categoryStats.getCategoryStats(cat);
      if (stats) {
        categoryStats[cat] = stats;
      }
    }

    return Result.ok({
      progress: {
        level: updatedUser.progress.level.value,
        experience: updatedUser.progress.experience.value,
        totalQuestions: updatedUser.progress.totalQuestions,
        correctAnswers: updatedUser.progress.correctAnswers,
        accuracy: updatedUser.progress.accuracy.value,
        studyTimeMinutes: updatedUser.progress.studyTime.minutes,
        currentStreak: updatedUser.progress.currentStreak.days,
        lastStudyDate: updatedUser.progress.lastStudyDate,
        categoryStats,
      },
    });
  } catch (error) {
    // Handle unexpected errors
    return Result.fail(error instanceof Error ? error : new Error('Unknown error'));
  }
}
