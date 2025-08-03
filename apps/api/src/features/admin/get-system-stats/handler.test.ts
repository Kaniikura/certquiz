import type { IAuthUserRepository } from '@api/features/auth/domain/repositories/IAuthUserRepository';
import type { IQuestionRepository } from '@api/features/question/domain/repositories/IQuestionRepository';
import type { IQuizRepository } from '@api/features/quiz/domain/repositories/IQuizRepository';
import type { IUserRepository } from '@api/features/user/domain/repositories/IUserRepository';
import type { IUnitOfWork } from '@api/infra/db/IUnitOfWork';
import {
  AUTH_USER_REPO_TOKEN,
  QUESTION_REPO_TOKEN,
  QUIZ_REPO_TOKEN,
  type RepositoryToken,
  USER_REPO_TOKEN,
} from '@api/shared/types/RepositoryToken';
import { describe, expect, it, vi } from 'vitest';
import { getSystemStatsHandler } from './handler';

describe('getSystemStatsHandler', () => {
  it('should aggregate system statistics', async () => {
    // Arrange
    const mockAuthUserRepo: Partial<IAuthUserRepository> = {
      countTotalUsers: vi.fn().mockResolvedValue(150),
      countActiveUsers: vi.fn().mockResolvedValue(45),
    };
    const mockUserRepo: Partial<IUserRepository> = {
      getAverageLevel: vi.fn().mockResolvedValue(3.2),
      getTotalExperience: vi.fn().mockResolvedValue(125000),
    };
    const mockQuizRepo: Partial<IQuizRepository> = {
      countTotalSessions: vi.fn().mockResolvedValue(500),
      countActiveSessions: vi.fn().mockResolvedValue(12),
      getAverageScore: vi.fn().mockResolvedValue(0.75),
    };
    const mockQuestionRepo: Partial<IQuestionRepository> = {
      countTotalQuestions: vi.fn().mockResolvedValue(1000),
      countPendingQuestions: vi.fn().mockResolvedValue(25),
    };

    const mockUnitOfWork: IUnitOfWork = {
      getRepository: <T>(token: RepositoryToken<T>): T => {
        if (token === AUTH_USER_REPO_TOKEN) return mockAuthUserRepo as T;
        if (token === USER_REPO_TOKEN) return mockUserRepo as T;
        if (token === QUIZ_REPO_TOKEN) return mockQuizRepo as T;
        if (token === QUESTION_REPO_TOKEN) return mockQuestionRepo as T;
        throw new Error(`Unknown token: ${String(token)}`);
      },
      begin: vi.fn().mockResolvedValue(undefined),
      commit: vi.fn().mockResolvedValue(undefined),
      rollback: vi.fn().mockResolvedValue(undefined),
    };

    // Act
    const result = await getSystemStatsHandler(mockUnitOfWork);

    // Assert
    expect(result).toEqual({
      users: {
        total: 150,
        active: 45,
        averageLevel: 3.2,
      },
      quizzes: {
        total: 500,
        activeSessions: 12,
        averageScore: 75,
      },
      questions: {
        total: 1000,
        pending: 25,
      },
      system: {
        totalExperience: 125000,
        timestamp: expect.any(Date),
      },
    });

    // Verify all repository methods were called
    expect(mockAuthUserRepo.countTotalUsers).toHaveBeenCalledOnce();
    expect(mockAuthUserRepo.countActiveUsers).toHaveBeenCalledOnce();
    expect(mockUserRepo.getAverageLevel).toHaveBeenCalledOnce();
    expect(mockUserRepo.getTotalExperience).toHaveBeenCalledOnce();
    expect(mockQuizRepo.countTotalSessions).toHaveBeenCalledOnce();
    expect(mockQuizRepo.countActiveSessions).toHaveBeenCalledOnce();
    expect(mockQuizRepo.getAverageScore).toHaveBeenCalledOnce();
    expect(mockQuestionRepo.countTotalQuestions).toHaveBeenCalledOnce();
    expect(mockQuestionRepo.countPendingQuestions).toHaveBeenCalledOnce();
  });

  it('should handle zero values gracefully', async () => {
    // Arrange
    const mockAuthUserRepo: Partial<IAuthUserRepository> = {
      countTotalUsers: vi.fn().mockResolvedValue(0),
      countActiveUsers: vi.fn().mockResolvedValue(0),
    };
    const mockUserRepo: Partial<IUserRepository> = {
      getAverageLevel: vi.fn().mockResolvedValue(0),
      getTotalExperience: vi.fn().mockResolvedValue(0),
    };
    const mockQuizRepo: Partial<IQuizRepository> = {
      countTotalSessions: vi.fn().mockResolvedValue(0),
      countActiveSessions: vi.fn().mockResolvedValue(0),
      getAverageScore: vi.fn().mockResolvedValue(0),
    };
    const mockQuestionRepo: Partial<IQuestionRepository> = {
      countTotalQuestions: vi.fn().mockResolvedValue(0),
      countPendingQuestions: vi.fn().mockResolvedValue(0),
    };

    const mockUnitOfWork: IUnitOfWork = {
      getRepository: <T>(token: RepositoryToken<T>): T => {
        if (token === AUTH_USER_REPO_TOKEN) return mockAuthUserRepo as T;
        if (token === USER_REPO_TOKEN) return mockUserRepo as T;
        if (token === QUIZ_REPO_TOKEN) return mockQuizRepo as T;
        if (token === QUESTION_REPO_TOKEN) return mockQuestionRepo as T;
        throw new Error(`Unknown token: ${String(token)}`);
      },
      begin: vi.fn().mockResolvedValue(undefined),
      commit: vi.fn().mockResolvedValue(undefined),
      rollback: vi.fn().mockResolvedValue(undefined),
    };

    // Act
    const result = await getSystemStatsHandler(mockUnitOfWork);

    // Assert
    expect(result).toEqual({
      users: {
        total: 0,
        active: 0,
        averageLevel: 0,
      },
      quizzes: {
        total: 0,
        activeSessions: 0,
        averageScore: 0,
      },
      questions: {
        total: 0,
        pending: 0,
      },
      system: {
        totalExperience: 0,
        timestamp: expect.any(Date),
      },
    });
  });

  it('should execute all queries in parallel for performance', async () => {
    // Arrange
    const delays = {
      countTotalUsers: 100,
      countActiveUsers: 150,
      getAverageLevel: 200,
      getTotalExperience: 50,
      countTotalSessions: 120,
      countActiveSessions: 80,
      getAverageScore: 90,
      countTotalQuestions: 110,
      countPendingQuestions: 70,
    };

    const createDelayedMock = <T>(value: T, delay: number) =>
      vi.fn().mockImplementation(
        () =>
          new Promise<T>((resolve) => {
            setTimeout(() => resolve(value), delay);
          })
      );

    const mockAuthUserRepo: Partial<IAuthUserRepository> = {
      countTotalUsers: createDelayedMock(100, delays.countTotalUsers),
      countActiveUsers: createDelayedMock(50, delays.countActiveUsers),
    };
    const mockUserRepo: Partial<IUserRepository> = {
      getAverageLevel: createDelayedMock(3, delays.getAverageLevel),
      getTotalExperience: createDelayedMock(100000, delays.getTotalExperience),
    };
    const mockQuizRepo: Partial<IQuizRepository> = {
      countTotalSessions: createDelayedMock(200, delays.countTotalSessions),
      countActiveSessions: createDelayedMock(10, delays.countActiveSessions),
      getAverageScore: createDelayedMock(0.8, delays.getAverageScore),
    };
    const mockQuestionRepo: Partial<IQuestionRepository> = {
      countTotalQuestions: createDelayedMock(500, delays.countTotalQuestions),
      countPendingQuestions: createDelayedMock(20, delays.countPendingQuestions),
    };

    const mockUnitOfWork: IUnitOfWork = {
      getRepository: <T>(token: RepositoryToken<T>): T => {
        if (token === AUTH_USER_REPO_TOKEN) return mockAuthUserRepo as T;
        if (token === USER_REPO_TOKEN) return mockUserRepo as T;
        if (token === QUIZ_REPO_TOKEN) return mockQuizRepo as T;
        if (token === QUESTION_REPO_TOKEN) return mockQuestionRepo as T;
        throw new Error(`Unknown token: ${String(token)}`);
      },
      begin: vi.fn().mockResolvedValue(undefined),
      commit: vi.fn().mockResolvedValue(undefined),
      rollback: vi.fn().mockResolvedValue(undefined),
    };

    const startTime = Date.now();

    // Act
    await getSystemStatsHandler(mockUnitOfWork);

    // Assert
    const elapsedTime = Date.now() - startTime;
    const maxDelay = Math.max(...Object.values(delays));

    // If queries run in parallel, total time should be close to the longest query
    // Add some buffer for execution overhead
    expect(elapsedTime).toBeLessThan(maxDelay + 50);
  });
});
