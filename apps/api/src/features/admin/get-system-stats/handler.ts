/**
 * System statistics handler
 * @fileoverview Business logic for aggregating system-wide statistics
 */

import type { IUnitOfWork } from '@api/infra/db/IUnitOfWork';
import {
  AUTH_USER_REPO_TOKEN,
  QUESTION_REPO_TOKEN,
  QUIZ_REPO_TOKEN,
  USER_REPO_TOKEN,
} from '@api/shared/types/RepositoryToken';
import type { SystemStats } from './dto';

export async function getSystemStatsHandler(unitOfWork: IUnitOfWork): Promise<SystemStats> {
  // Get repositories from unit of work
  const authUserRepo = unitOfWork.getRepository(AUTH_USER_REPO_TOKEN);
  const userRepo = unitOfWork.getRepository(USER_REPO_TOKEN);
  const quizRepo = unitOfWork.getRepository(QUIZ_REPO_TOKEN);
  const questionRepo = unitOfWork.getRepository(QUESTION_REPO_TOKEN);

  // Parallel aggregation for performance
  let totalUsers: number;
  let activeUsers: number;
  let averageLevel: number;
  let totalExperience: number;
  let totalSessions: number;
  let activeSessions: number;
  let averageScore: number;
  let totalQuestions: number;
  let pendingQuestions: number;

  try {
    [
      totalUsers,
      activeUsers,
      averageLevel,
      totalExperience,
      totalSessions,
      activeSessions,
      averageScore,
      totalQuestions,
      pendingQuestions,
    ] = await Promise.all([
      authUserRepo.countTotalUsers(),
      authUserRepo.countActiveUsers(),
      userRepo.getAverageLevel(),
      userRepo.getTotalExperience(),
      quizRepo.countTotalSessions(),
      quizRepo.countActiveSessions(),
      quizRepo.getAverageScore(),
      questionRepo.countTotalQuestions(),
      questionRepo.countPendingQuestions(),
    ]);
  } catch (error) {
    // Log the error with context for debugging
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    // Re-throw with additional context while preserving the original error
    throw new Error(`Failed to fetch system statistics: ${errorMessage}`, { cause: error });
  }

  return {
    users: {
      total: totalUsers,
      active: activeUsers,
      averageLevel,
    },
    quizzes: {
      total: totalSessions,
      activeSessions,
      averageScore: Math.round(averageScore * 100),
    },
    questions: {
      total: totalQuestions,
      pending: pendingQuestions,
    },
    system: {
      totalExperience,
      timestamp: new Date(),
    },
  };
}
