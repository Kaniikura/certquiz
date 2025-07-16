/**
 * User progress seed data
 * @fileoverview Seed data for user progress tracking
 */

import type { DB } from '@api/infra/db/client';
import { userProgress } from '@api/infra/db/schema';
import type { LoggerPort } from '@api/shared/logger';
import { Result } from '@api/shared/result';
import { eq } from 'drizzle-orm';

import { getActiveSeededUsers, seedUuid } from './users.seed';

/**
 * Progress seed data structure
 */
export interface ProgressSeedData {
  userId: string;
  level: number;
  experience: number;
  totalQuestions: number;
  correctAnswers: number;
  accuracy: number;
  studyTimeMinutes: number;
  currentStreak: number;
  lastStudyDate?: Date;
  categoryStats?: {
    version: number;
    categories: Record<
      string,
      {
        attempted: number;
        correct: number;
        avgTime: number;
      }
    >;
  };
}

/**
 * Generate progress data for seeded users
 */
function generateProgressData(): ProgressSeedData[] {
  const now = new Date();

  return [
    // Admin user - experienced
    {
      userId: seedUuid('seed-admin-001'),
      level: 10,
      experience: 5000,
      totalQuestions: 500,
      correctAnswers: 450,
      accuracy: 90.0,
      studyTimeMinutes: 1200,
      currentStreak: 30,
      lastStudyDate: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000), // 1 day ago
      categoryStats: {
        version: 1,
        categories: {
          CCNA: { attempted: 200, correct: 180, avgTime: 45 },
          CCNP_ENCOR: { attempted: 150, correct: 135, avgTime: 60 },
          SECURITY_PLUS: { attempted: 150, correct: 135, avgTime: 50 },
        },
      },
    },
    // Premium user 1 - active learner
    {
      userId: seedUuid('seed-premium-001'),
      level: 5,
      experience: 2500,
      totalQuestions: 250,
      correctAnswers: 200,
      accuracy: 80.0,
      studyTimeMinutes: 600,
      currentStreak: 7,
      lastStudyDate: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000), // 1 day ago
      categoryStats: {
        version: 1,
        categories: {
          CCNA: { attempted: 150, correct: 120, avgTime: 40 },
          CCNP_ENCOR: { attempted: 100, correct: 80, avgTime: 55 },
        },
      },
    },
    // Premium user 2 - casual learner
    {
      userId: seedUuid('seed-premium-002'),
      level: 3,
      experience: 1000,
      totalQuestions: 100,
      correctAnswers: 70,
      accuracy: 70.0,
      studyTimeMinutes: 240,
      currentStreak: 3,
      lastStudyDate: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
      categoryStats: {
        version: 1,
        categories: {
          CCNA: { attempted: 100, correct: 70, avgTime: 50 },
        },
      },
    },
    // Regular user 1 - beginner
    {
      userId: seedUuid('seed-user-001'),
      level: 2,
      experience: 300,
      totalQuestions: 30,
      correctAnswers: 18,
      accuracy: 60.0,
      studyTimeMinutes: 90,
      currentStreak: 1,
      lastStudyDate: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000), // 1 day ago
      categoryStats: {
        version: 1,
        categories: {
          CCNA: { attempted: 30, correct: 18, avgTime: 60 },
        },
      },
    },
    // Regular user 2 - no activity yet
    {
      userId: seedUuid('seed-user-002'),
      level: 1,
      experience: 0,
      totalQuestions: 0,
      correctAnswers: 0,
      accuracy: 0.0,
      studyTimeMinutes: 0,
      currentStreak: 0,
      lastStudyDate: undefined,
      categoryStats: {
        version: 1,
        categories: {},
      },
    },
    // Guest user - minimal activity
    {
      userId: seedUuid('seed-guest-001'),
      level: 1,
      experience: 50,
      totalQuestions: 10,
      correctAnswers: 5,
      accuracy: 50.0,
      studyTimeMinutes: 15,
      currentStreak: 0,
      lastStudyDate: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
      categoryStats: {
        version: 1,
        categories: {
          CCNA: { attempted: 10, correct: 5, avgTime: 90 },
        },
      },
    },
  ];
}

/**
 * Create user progress records
 */
export async function up(db: DB, logger: LoggerPort): Promise<Result<void, Error>> {
  try {
    const progressData = generateProgressData();
    logger.info(`Seeding progress for ${progressData.length} users`);

    for (const progress of progressData) {
      logger.debug(`Creating progress for user: ${progress.userId}`);

      // Check if progress already exists
      const existing = await db.query.userProgress.findFirst({
        where: eq(userProgress.userId, progress.userId),
      });

      if (existing) {
        logger.debug(`Progress for user ${progress.userId} already exists, skipping`);
        continue;
      }

      await db.insert(userProgress).values({
        userId: progress.userId,
        level: progress.level,
        experience: progress.experience,
        totalQuestions: progress.totalQuestions,
        correctAnswers: progress.correctAnswers,
        accuracy: progress.accuracy.toFixed(1), // stored as decimal string
        studyTimeMinutes: progress.studyTimeMinutes,
        currentStreak: progress.currentStreak,
        lastStudyDate: progress.lastStudyDate ?? null,
        categoryStats: progress.categoryStats ?? { version: 1 },
        updatedAt: new Date(),
      });

      logger.debug(`Created progress for user: ${progress.userId}`);
    }

    logger.info('User progress seeding completed');
    return Result.ok(undefined);
  } catch (error) {
    logger.error('Failed to seed user progress', {
      error: error instanceof Error ? error.message : String(error),
    });
    return Result.err(new Error(`User progress seeding failed: ${error}`));
  }
}

/**
 * Remove seeded progress data
 */
export async function down(db: DB, logger: LoggerPort): Promise<Result<void, Error>> {
  try {
    logger.info('Removing seeded user progress');

    // Get all seed user IDs
    const seedUserIds = getActiveSeededUsers().map((u) => u.id);

    for (const userId of seedUserIds) {
      await db.delete(userProgress).where(eq(userProgress.userId, userId));
      logger.debug(`Removed progress for user: ${userId}`);
    }

    logger.info('User progress cleanup completed');
    return Result.ok(undefined);
  } catch (error) {
    logger.error('Failed to remove seeded user progress', {
      error: error instanceof Error ? error.message : String(error),
    });
    return Result.err(new Error(`User progress cleanup failed: ${error}`));
  }
}
