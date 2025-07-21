/**
 * Get profile handler implementation
 * @fileoverview Business logic for retrieving user profile and progress
 */

import { ValidationError } from '@api/shared/errors';
import { Result } from '@api/shared/result';
import type { IUserRepository } from '../domain/repositories/IUserRepository';
import { UserId } from '../domain/value-objects';
import type { GetProfileResponse } from './dto';
import { getProfileSchema } from './validation';

/**
 * Custom errors for get profile use case
 */
export class UserNotFoundError extends Error {
  constructor(userId: string) {
    super(`User with ID ${userId} not found`);
    this.name = 'UserNotFoundError';
  }
}

/**
 * Get profile use case handler
 * Retrieves user profile with complete progress information
 */
export async function getProfileHandler(
  input: unknown,
  userRepository: IUserRepository
): Promise<Result<GetProfileResponse, Error>> {
  try {
    // 1. Validate input using Zod schema
    const validationResult = getProfileSchema.safeParse(input);
    if (!validationResult.success) {
      return Result.fail(new ValidationError(validationResult.error.message));
    }

    const { userId } = validationResult.data;

    // 2. Find user by ID
    const userIdValue = UserId.of(userId);
    const user = await userRepository.findById(userIdValue);
    if (!user) {
      return Result.fail(new UserNotFoundError(userId));
    }

    // 3. Extract category statistics
    const categoryStats: {
      [category: string]: { correct: number; total: number; accuracy: number };
    } = {};
    for (const cat of user.progress.categoryStats.getAllCategories()) {
      const stats = user.progress.categoryStats.getCategoryStats(cat);
      if (stats) {
        categoryStats[cat] = stats;
      }
    }

    // 4. Return complete profile data
    return Result.ok({
      user: {
        id: UserId.toString(user.id),
        email: user.email.toString(),
        username: user.username,
        role: user.role,
        isActive: user.isActive,
        identityProviderId: user.identityProviderId,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        progress: {
          level: user.progress.level.value,
          experience: user.progress.experience.value,
          totalQuestions: user.progress.totalQuestions,
          correctAnswers: user.progress.correctAnswers,
          accuracy: user.progress.accuracy.value,
          studyTimeMinutes: user.progress.studyTime.minutes,
          currentStreak: user.progress.currentStreak.days,
          lastStudyDate: user.progress.lastStudyDate,
          streakLevel: user.progress.currentStreak.getStreakLevel(),
          categoryStats,
        },
      },
    });
  } catch (error) {
    // Handle unexpected errors
    return Result.fail(error instanceof Error ? error : new Error('Unknown error'));
  }
}
