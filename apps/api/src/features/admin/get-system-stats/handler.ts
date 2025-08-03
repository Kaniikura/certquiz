/**
 * System statistics handler
 * @fileoverview Business logic for aggregating system-wide statistics
 */

import type { IAuthUserRepository } from '@api/features/auth/domain/repositories/IAuthUserRepository';
import type { IQuestionRepository } from '@api/features/question/domain/repositories/IQuestionRepository';
import type { IQuizRepository } from '@api/features/quiz/domain/repositories/IQuizRepository';
import type { IUserRepository } from '@api/features/user/domain/repositories/IUserRepository';
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
  const authUserRepo = unitOfWork.getRepository(AUTH_USER_REPO_TOKEN) as IAuthUserRepository;
  const userRepo = unitOfWork.getRepository(USER_REPO_TOKEN) as IUserRepository;
  const quizRepo = unitOfWork.getRepository(QUIZ_REPO_TOKEN) as IQuizRepository;
  const questionRepo = unitOfWork.getRepository(QUESTION_REPO_TOKEN) as IQuestionRepository;

  // Parallel aggregation for performance
  const [
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
