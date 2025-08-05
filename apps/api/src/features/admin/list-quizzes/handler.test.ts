/**
 * List quizzes handler tests
 * @fileoverview Tests for admin quiz listing with pagination and filtering
 */

import type {
  IQuizRepository,
  QuizWithUserInfo,
} from '@api/features/quiz/domain/repositories/IQuizRepository';
import { QuizState } from '@api/features/quiz/domain/value-objects/QuizState';
import type { IUnitOfWork } from '@api/infra/db/IUnitOfWork';
import { ValidationError } from '@api/shared/errors';
import type { PaginatedResult } from '@api/shared/types/pagination';
import { QUIZ_REPO_TOKEN, type RepositoryToken } from '@api/shared/types/RepositoryToken';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ListQuizzesParams } from './dto';
import { listQuizzesHandler } from './handler';

describe('listQuizzesHandler', () => {
  let mockQuizRepo: IQuizRepository;
  let mockUnitOfWork: IUnitOfWork;

  beforeEach(() => {
    mockQuizRepo = {
      findById: vi.fn(),
      save: vi.fn(),
      findExpiredSessions: vi.fn(),
      findActiveByUser: vi.fn(),
      countTotalSessions: vi.fn(),
      countActiveSessions: vi.fn(),
      getAverageScore: vi.fn(),
      findAllForAdmin: vi.fn(),
      deleteWithCascade: vi.fn(),
    };

    mockUnitOfWork = {
      getRepository: <T>(token: RepositoryToken<T>): T => {
        if (token === QUIZ_REPO_TOKEN) return mockQuizRepo as T;
        throw new Error(`Unknown repository token: ${String(token)}`);
      },
      begin: vi.fn(),
      commit: vi.fn(),
      rollback: vi.fn(),
      getQuestionDetailsService: vi.fn().mockReturnValue(null),
    };
  });

  it('should return paginated quiz list with user info', async () => {
    // Arrange
    const mockQuizzes: QuizWithUserInfo[] = [
      {
        sessionId: '550e8400-e29b-41d4-a716-446655440000',
        userId: '550e8400-e29b-41d4-a716-446655440001',
        userEmail: 'user1@example.com',
        state: QuizState.Completed,
        score: 0.85,
        questionCount: 20,
        startedAt: new Date('2025-01-01T10:00:00Z'),
        completedAt: new Date('2025-01-01T10:30:00Z'),
      },
      {
        sessionId: '550e8400-e29b-41d4-a716-446655440002',
        userId: '550e8400-e29b-41d4-a716-446655440003',
        userEmail: 'user2@example.com',
        state: QuizState.InProgress,
        score: null,
        questionCount: 15,
        startedAt: new Date('2025-01-01T11:00:00Z'),
        completedAt: null,
      },
    ];

    const mockResult: PaginatedResult<QuizWithUserInfo> = {
      items: mockQuizzes,
      total: 100,
      page: 1,
      pageSize: 20,
    };

    vi.mocked(mockQuizRepo.findAllForAdmin).mockResolvedValue(mockResult);

    const params: ListQuizzesParams = { page: 1, pageSize: 20 };

    // Act
    const result = await listQuizzesHandler(params, mockUnitOfWork);

    // Assert
    expect(result.items).toHaveLength(2);
    expect(result.total).toBe(100);
    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(20);
    expect(result.totalPages).toBe(5); // 100/20 = 5

    expect(result.items[0]).toEqual({
      sessionId: '550e8400-e29b-41d4-a716-446655440000',
      userId: '550e8400-e29b-41d4-a716-446655440001',
      userEmail: 'user1@example.com',
      state: 'COMPLETED',
      score: 85, // Converted to percentage
      questionCount: 20,
      startedAt: new Date('2025-01-01T10:00:00Z'),
      completedAt: new Date('2025-01-01T10:30:00Z'),
      duration: 1800, // 30 minutes in seconds
    });

    expect(result.items[1]).toEqual({
      sessionId: '550e8400-e29b-41d4-a716-446655440002',
      userId: '550e8400-e29b-41d4-a716-446655440003',
      userEmail: 'user2@example.com',
      state: 'IN_PROGRESS',
      score: null,
      questionCount: 15,
      startedAt: new Date('2025-01-01T11:00:00Z'),
      completedAt: null,
      duration: null, // No completion time for active quiz
    });

    expect(mockQuizRepo.findAllForAdmin).toHaveBeenCalledWith({
      page: 1,
      pageSize: 20,
      filters: undefined,
      orderBy: 'startedAt',
      orderDir: 'desc',
    });
  });

  it('should apply state filter correctly', async () => {
    // Arrange
    const mockResult: PaginatedResult<QuizWithUserInfo> = {
      items: [],
      total: 0,
      page: 1,
      pageSize: 20,
    };

    vi.mocked(mockQuizRepo.findAllForAdmin).mockResolvedValue(mockResult);

    const params: ListQuizzesParams = {
      page: 1,
      pageSize: 20,
      state: 'COMPLETED',
    };

    // Act
    await listQuizzesHandler(params, mockUnitOfWork);

    // Assert
    expect(mockQuizRepo.findAllForAdmin).toHaveBeenCalledWith({
      page: 1,
      pageSize: 20,
      filters: {
        state: QuizState.Completed,
      },
      orderBy: 'startedAt',
      orderDir: 'desc',
    });
  });

  it('should apply userId filter correctly', async () => {
    // Arrange
    const mockResult: PaginatedResult<QuizWithUserInfo> = {
      items: [],
      total: 0,
      page: 1,
      pageSize: 20,
    };

    vi.mocked(mockQuizRepo.findAllForAdmin).mockResolvedValue(mockResult);

    const params: ListQuizzesParams = {
      page: 1,
      pageSize: 20,
      userId: '550e8400-e29b-41d4-a716-446655440004',
    };

    // Act
    await listQuizzesHandler(params, mockUnitOfWork);

    // Assert
    expect(mockQuizRepo.findAllForAdmin).toHaveBeenCalledWith({
      page: 1,
      pageSize: 20,
      filters: {
        userId: '550e8400-e29b-41d4-a716-446655440004',
      },
      orderBy: 'startedAt',
      orderDir: 'desc',
    });
  });

  it('should apply date range filter correctly', async () => {
    // Arrange
    const mockResult: PaginatedResult<QuizWithUserInfo> = {
      items: [],
      total: 0,
      page: 1,
      pageSize: 20,
    };

    vi.mocked(mockQuizRepo.findAllForAdmin).mockResolvedValue(mockResult);

    const dateFrom = new Date('2025-01-01');
    const dateTo = new Date('2025-01-31');

    const params: ListQuizzesParams = {
      page: 1,
      pageSize: 20,
      dateFrom,
      dateTo,
    };

    // Act
    await listQuizzesHandler(params, mockUnitOfWork);

    // Assert
    expect(mockQuizRepo.findAllForAdmin).toHaveBeenCalledWith({
      page: 1,
      pageSize: 20,
      filters: {
        startDate: new Date('2025-01-01'),
        endDate: new Date('2025-01-31'),
      },
      orderBy: 'startedAt',
      orderDir: 'desc',
    });
  });

  it('should apply multiple filters correctly', async () => {
    // Arrange
    const mockResult: PaginatedResult<QuizWithUserInfo> = {
      items: [],
      total: 0,
      page: 1,
      pageSize: 20,
    };

    vi.mocked(mockQuizRepo.findAllForAdmin).mockResolvedValue(mockResult);

    const dateFrom = new Date('2025-01-01');
    const dateTo = new Date('2025-01-31');

    const params: ListQuizzesParams = {
      page: 2,
      pageSize: 10,
      state: 'IN_PROGRESS',
      userId: '550e8400-e29b-41d4-a716-446655440005',
      dateFrom,
      dateTo,
    };

    // Act
    await listQuizzesHandler(params, mockUnitOfWork);

    // Assert
    expect(mockQuizRepo.findAllForAdmin).toHaveBeenCalledWith({
      page: 2,
      pageSize: 10,
      filters: {
        state: QuizState.InProgress,
        userId: '550e8400-e29b-41d4-a716-446655440005',
        startDate: new Date('2025-01-01'),
        endDate: new Date('2025-01-31'),
      },
      orderBy: 'startedAt',
      orderDir: 'desc',
    });
  });

  it('should handle empty results gracefully', async () => {
    // Arrange
    const mockResult: PaginatedResult<QuizWithUserInfo> = {
      items: [],
      total: 0,
      page: 1,
      pageSize: 20,
    };

    vi.mocked(mockQuizRepo.findAllForAdmin).mockResolvedValue(mockResult);

    const params: ListQuizzesParams = { page: 1, pageSize: 20 };

    // Act
    const result = await listQuizzesHandler(params, mockUnitOfWork);

    // Assert
    expect(result.items).toHaveLength(0);
    expect(result.total).toBe(0);
    expect(result.totalPages).toBe(0);
  });

  it('should validate page number', async () => {
    // Arrange
    const params: ListQuizzesParams = { page: 0, pageSize: 20 };

    // Act & Assert
    await expect(listQuizzesHandler(params, mockUnitOfWork)).rejects.toThrow(ValidationError);
    await expect(listQuizzesHandler(params, mockUnitOfWork)).rejects.toThrow(
      'Page must be greater than 0'
    );
  });

  it('should validate page size', async () => {
    // Arrange
    const params: ListQuizzesParams = { page: 1, pageSize: 0 };

    // Act & Assert
    await expect(listQuizzesHandler(params, mockUnitOfWork)).rejects.toThrow(ValidationError);
    await expect(listQuizzesHandler(params, mockUnitOfWork)).rejects.toThrow(
      'Page size must be between 1 and 100'
    );
  });

  it('should limit maximum page size', async () => {
    // Arrange
    const params: ListQuizzesParams = { page: 1, pageSize: 200 };

    // Act & Assert
    await expect(listQuizzesHandler(params, mockUnitOfWork)).rejects.toThrow(ValidationError);
    await expect(listQuizzesHandler(params, mockUnitOfWork)).rejects.toThrow(
      'Page size must be between 1 and 100'
    );
  });

  it('should calculate duration correctly for completed quizzes', async () => {
    // Arrange
    const startTime = new Date('2025-01-01T10:00:00Z');
    const endTime = new Date('2025-01-01T10:45:00Z'); // 45 minutes later

    const mockQuiz: QuizWithUserInfo = {
      sessionId: '550e8400-e29b-41d4-a716-446655440006',
      userId: '550e8400-e29b-41d4-a716-446655440007',
      userEmail: 'user@example.com',
      state: QuizState.Completed,
      score: 0.9,
      questionCount: 25,
      startedAt: startTime,
      completedAt: endTime,
    };

    const mockResult: PaginatedResult<QuizWithUserInfo> = {
      items: [mockQuiz],
      total: 1,
      page: 1,
      pageSize: 20,
    };

    vi.mocked(mockQuizRepo.findAllForAdmin).mockResolvedValue(mockResult);

    const params: ListQuizzesParams = { page: 1, pageSize: 20 };

    // Act
    const result = await listQuizzesHandler(params, mockUnitOfWork);

    // Assert
    expect(result.items[0].duration).toBe(2700); // 45 minutes = 2700 seconds
  });

  it('should validate date range order', async () => {
    // Arrange
    const dateFrom = new Date('2025-01-31');
    const dateTo = new Date('2025-01-01'); // Invalid: from > to

    const params: ListQuizzesParams = {
      page: 1,
      pageSize: 20,
      dateFrom,
      dateTo,
    };

    // Act & Assert
    await expect(listQuizzesHandler(params, mockUnitOfWork)).rejects.toThrow(ValidationError);
    await expect(listQuizzesHandler(params, mockUnitOfWork)).rejects.toThrow(
      'dateFrom must be before or equal to dateTo'
    );
  });

  it('should validate invalid state values', async () => {
    // Arrange
    const params: ListQuizzesParams = {
      page: 1,
      pageSize: 20,
      state: 'INVALID_STATE' as string,
    };

    // Act & Assert
    await expect(listQuizzesHandler(params, mockUnitOfWork)).rejects.toThrow(ValidationError);
  });
});
