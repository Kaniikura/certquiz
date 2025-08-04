/**
 * List Pending Questions Handler Tests
 * @fileoverview TDD tests for pending questions listing functionality
 */

import { QuestionStatus } from '@api/features/question/domain/entities/Question';
import type {
  IQuestionRepository,
  QuestionWithModerationInfo,
} from '@api/features/question/domain/repositories/IQuestionRepository';
import type { QuestionId } from '@api/features/quiz/domain/value-objects/Ids';
import type { IUnitOfWork } from '@api/infra/db/IUnitOfWork';
import { ValidationError } from '@api/shared/errors';
import { QUESTION_REPO_TOKEN, type RepositoryToken } from '@api/shared/types/RepositoryToken';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ListPendingQuestionsParams, ListPendingQuestionsResponse } from './dto';
import { listPendingQuestionsHandler } from './handler';

describe('listPendingQuestionsHandler', () => {
  let mockQuestionRepo: IQuestionRepository;
  let mockUnitOfWork: IUnitOfWork;

  beforeEach(() => {
    mockQuestionRepo = {
      findQuestions: vi.fn(),
      findQuestionById: vi.fn(),
      getQuestionStats: vi.fn(),
      createQuestion: vi.fn(),
      updateQuestion: vi.fn(),
      findQuestionWithDetails: vi.fn(),
      countTotalQuestions: vi.fn(),
      countPendingQuestions: vi.fn(),
      updateStatus: vi.fn(),
      findQuestionsForModeration: vi.fn(),
    };

    mockUnitOfWork = {
      getRepository: <T>(token: RepositoryToken<T>): T => {
        if (token === QUESTION_REPO_TOKEN) return mockQuestionRepo as T;
        throw new Error(`Unknown repository token: ${String(token)}`);
      },
      begin: vi.fn(),
      commit: vi.fn(),
      rollback: vi.fn(),
    };
  });

  it('should return paginated pending questions list', async () => {
    // Arrange
    const mockQuestions: QuestionWithModerationInfo[] = [
      {
        questionId: '550e8400-e29b-41d4-a716-446655440000' as QuestionId,
        questionText: 'What is the purpose of VLAN?',
        questionType: 'multiple_choice',
        examTypes: ['CCNA'],
        categories: ['Networking'],
        difficulty: 'Intermediate',
        status: QuestionStatus.DRAFT,
        isPremium: false,
        tags: ['vlan', 'networking'],
        createdById: '550e8400-e29b-41d4-a716-446655440001',
        createdAt: new Date('2025-01-01T10:00:00Z'),
        updatedAt: new Date('2025-01-01T10:00:00Z'),
        daysPending: 5,
      },
      {
        questionId: '550e8400-e29b-41d4-a716-446655440002' as QuestionId,
        questionText: 'Which protocol is used for routing?',
        questionType: 'multiple_select',
        examTypes: ['CCNP'],
        categories: ['Routing'],
        difficulty: 'advanced',
        status: QuestionStatus.DRAFT,
        isPremium: true,
        tags: ['routing', 'protocol'],
        createdById: '550e8400-e29b-41d4-a716-446655440003',
        createdAt: new Date('2025-01-01T11:00:00Z'),
        updatedAt: new Date('2025-01-01T11:00:00Z'),
        daysPending: 10,
      },
    ];

    const mockResult = {
      items: mockQuestions,
      total: 25,
      page: 1,
      pageSize: 20,
    };

    vi.mocked(mockQuestionRepo.findQuestionsForModeration).mockResolvedValue(mockResult);

    const params: ListPendingQuestionsParams = { page: 1, pageSize: 20 };

    // Act
    const result = (await listPendingQuestionsHandler(
      params,
      mockUnitOfWork
    )) as ListPendingQuestionsResponse;

    // Assert
    expect(result.items).toHaveLength(2);
    expect(result.total).toBe(25);
    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(20);
    expect(result.totalPages).toBe(2); // Math.ceil(25/20) = 2

    expect(result.items[0]).toEqual({
      questionId: '550e8400-e29b-41d4-a716-446655440000',
      questionText: 'What is the purpose of VLAN?',
      questionType: 'multiple_choice',
      examTypes: ['CCNA'],
      categories: ['Networking'],
      difficulty: 'Intermediate',
      status: 'draft',
      isPremium: false,
      tags: ['vlan', 'networking'],
      createdById: '550e8400-e29b-41d4-a716-446655440001',
      createdAt: new Date('2025-01-01T10:00:00Z'),
      updatedAt: new Date('2025-01-01T10:00:00Z'),
      daysPending: 5,
      priority: 'medium', // 5 days = medium priority
    });

    expect(result.items[1]).toEqual({
      questionId: '550e8400-e29b-41d4-a716-446655440002',
      questionText: 'Which protocol is used for routing?',
      questionType: 'multiple_select',
      examTypes: ['CCNP'],
      categories: ['Routing'],
      difficulty: 'advanced',
      status: 'draft',
      isPremium: true,
      tags: ['routing', 'protocol'],
      createdById: '550e8400-e29b-41d4-a716-446655440003',
      createdAt: new Date('2025-01-01T11:00:00Z'),
      updatedAt: new Date('2025-01-01T11:00:00Z'),
      daysPending: 10,
      priority: 'high', // 10 days = high priority
    });

    expect(result.summary.totalPending).toBe(25);
    expect(result.summary.averageDaysPending).toBe(7.5); // (5 + 10) / 2
    expect(result.summary.priorityCounts.medium).toBe(1);
    expect(result.summary.priorityCounts.high).toBe(1);

    expect(mockQuestionRepo.findQuestionsForModeration).toHaveBeenCalledWith({
      page: 1,
      pageSize: 20,
      orderBy: 'createdAt',
      orderDir: 'desc',
    });
  });

  it('should apply status filter correctly', async () => {
    // Arrange
    const mockResult = {
      items: [],
      total: 0,
      page: 1,
      pageSize: 20,
    };

    vi.mocked(mockQuestionRepo.findQuestionsForModeration).mockResolvedValue(mockResult);

    const params: ListPendingQuestionsParams = {
      page: 1,
      pageSize: 20,
      status: 'ACTIVE',
    };

    // Act
    await listPendingQuestionsHandler(params, mockUnitOfWork);

    // Assert
    expect(mockQuestionRepo.findQuestionsForModeration).toHaveBeenCalledWith({
      page: 1,
      pageSize: 20,
      status: QuestionStatus.ACTIVE,
      orderBy: 'createdAt',
      orderDir: 'desc',
    });
  });

  it('should apply date range filter correctly', async () => {
    // Arrange
    const mockResult = {
      items: [],
      total: 0,
      page: 1,
      pageSize: 20,
    };

    vi.mocked(mockQuestionRepo.findQuestionsForModeration).mockResolvedValue(mockResult);

    const dateFrom = new Date('2025-01-01');
    const dateTo = new Date('2025-01-31');

    const params: ListPendingQuestionsParams = {
      page: 1,
      pageSize: 20,
      dateFrom,
      dateTo,
    };

    // Act
    await listPendingQuestionsHandler(params, mockUnitOfWork);

    // Assert
    expect(mockQuestionRepo.findQuestionsForModeration).toHaveBeenCalledWith({
      page: 1,
      pageSize: 20,
      dateFrom: new Date('2025-01-01'),
      dateTo: new Date('2025-01-31'),
      orderBy: 'createdAt',
      orderDir: 'desc',
    });
  });

  it('should apply exam type and difficulty filters correctly', async () => {
    // Arrange
    const mockResult = {
      items: [],
      total: 0,
      page: 1,
      pageSize: 20,
    };

    vi.mocked(mockQuestionRepo.findQuestionsForModeration).mockResolvedValue(mockResult);

    const params: ListPendingQuestionsParams = {
      page: 2,
      pageSize: 10,
      examType: 'CCNA',
      difficulty: 'Intermediate',
      orderBy: 'updatedAt',
      orderDir: 'asc',
    };

    // Act
    await listPendingQuestionsHandler(params, mockUnitOfWork);

    // Assert
    expect(mockQuestionRepo.findQuestionsForModeration).toHaveBeenCalledWith({
      page: 2,
      pageSize: 10,
      examType: 'CCNA',
      difficulty: 'Intermediate',
      orderBy: 'updatedAt',
      orderDir: 'asc',
    });
  });

  it('should handle empty results gracefully', async () => {
    // Arrange
    const mockResult = {
      items: [],
      total: 0,
      page: 1,
      pageSize: 20,
    };

    vi.mocked(mockQuestionRepo.findQuestionsForModeration).mockResolvedValue(mockResult);

    const params: ListPendingQuestionsParams = { page: 1, pageSize: 20 };

    // Act
    const result = (await listPendingQuestionsHandler(
      params,
      mockUnitOfWork
    )) as ListPendingQuestionsResponse;

    // Assert
    expect(result.items).toHaveLength(0);
    expect(result.total).toBe(0);
    expect(result.totalPages).toBe(0);
    expect(result.summary.totalPending).toBe(0);
    expect(result.summary.averageDaysPending).toBe(0);
    expect(result.summary.priorityCounts.low).toBe(0);
    expect(result.summary.priorityCounts.medium).toBe(0);
    expect(result.summary.priorityCounts.high).toBe(0);
    expect(result.summary.priorityCounts.urgent).toBe(0);
  });

  it('should validate page number', async () => {
    // Arrange
    const params = { page: 0, pageSize: 20 };

    // Act & Assert
    await expect(listPendingQuestionsHandler(params, mockUnitOfWork)).rejects.toThrow(
      ValidationError
    );
    await expect(listPendingQuestionsHandler(params, mockUnitOfWork)).rejects.toThrow(
      'page: Page must be greater than 0'
    );
  });

  it('should validate page size', async () => {
    // Arrange
    const params = { page: 1, pageSize: 0 };

    // Act & Assert
    await expect(listPendingQuestionsHandler(params, mockUnitOfWork)).rejects.toThrow(
      ValidationError
    );
    await expect(listPendingQuestionsHandler(params, mockUnitOfWork)).rejects.toThrow(
      'pageSize: Page size must be between 1 and 100'
    );
  });

  it('should limit maximum page size', async () => {
    // Arrange
    const params = { page: 1, pageSize: 200 };

    // Act & Assert
    await expect(listPendingQuestionsHandler(params, mockUnitOfWork)).rejects.toThrow(
      ValidationError
    );
    await expect(listPendingQuestionsHandler(params, mockUnitOfWork)).rejects.toThrow(
      'pageSize: Page size must be between 1 and 100'
    );
  });

  it('should validate date range order', async () => {
    // Arrange
    const dateFrom = new Date('2025-01-31');
    const dateTo = new Date('2025-01-01'); // Invalid: from > to

    const params = {
      page: 1,
      pageSize: 20,
      dateFrom,
      dateTo,
    };

    // Act & Assert
    await expect(listPendingQuestionsHandler(params, mockUnitOfWork)).rejects.toThrow(
      ValidationError
    );
    await expect(listPendingQuestionsHandler(params, mockUnitOfWork)).rejects.toThrow(
      'dateFrom must be before or equal to dateTo'
    );
  });

  it('should calculate priority levels correctly', async () => {
    // Arrange
    const mockQuestions: QuestionWithModerationInfo[] = [
      {
        // 1 day = low priority
        questionId: '1' as QuestionId,
        questionText: 'Question 1',
        questionType: 'multiple_choice',
        examTypes: ['CCNA'],
        categories: ['Test'],
        difficulty: 'Beginner',
        status: QuestionStatus.DRAFT,
        isPremium: false,
        tags: [],
        createdById: 'user1',
        createdAt: new Date(),
        updatedAt: new Date(),
        daysPending: 1,
      },
      {
        // 5 days = medium priority
        questionId: '2' as QuestionId,
        questionText: 'Question 2',
        questionType: 'multiple_choice',
        examTypes: ['CCNA'],
        categories: ['Test'],
        difficulty: 'Beginner',
        status: QuestionStatus.DRAFT,
        isPremium: false,
        tags: [],
        createdById: 'user2',
        createdAt: new Date(),
        updatedAt: new Date(),
        daysPending: 5,
      },
      {
        // 10 days = high priority
        questionId: '3' as QuestionId,
        questionText: 'Question 3',
        questionType: 'multiple_choice',
        examTypes: ['CCNA'],
        categories: ['Test'],
        difficulty: 'Beginner',
        status: QuestionStatus.DRAFT,
        isPremium: false,
        tags: [],
        createdById: 'user3',
        createdAt: new Date(),
        updatedAt: new Date(),
        daysPending: 10,
      },
      {
        // 20 days = urgent priority
        questionId: '4' as QuestionId,
        questionText: 'Question 4',
        questionType: 'multiple_choice',
        examTypes: ['CCNA'],
        categories: ['Test'],
        difficulty: 'Beginner',
        status: QuestionStatus.DRAFT,
        isPremium: false,
        tags: [],
        createdById: 'user4',
        createdAt: new Date(),
        updatedAt: new Date(),
        daysPending: 20,
      },
    ];

    const mockResult = {
      items: mockQuestions,
      total: 4,
      page: 1,
      pageSize: 20,
    };

    vi.mocked(mockQuestionRepo.findQuestionsForModeration).mockResolvedValue(mockResult);

    const params: ListPendingQuestionsParams = { page: 1, pageSize: 20 };

    // Act
    const result = (await listPendingQuestionsHandler(
      params,
      mockUnitOfWork
    )) as ListPendingQuestionsResponse;

    // Assert
    expect(result.items[0].priority).toBe('low');
    expect(result.items[1].priority).toBe('medium');
    expect(result.items[2].priority).toBe('high');
    expect(result.items[3].priority).toBe('urgent');

    expect(result.summary.priorityCounts.low).toBe(1);
    expect(result.summary.priorityCounts.medium).toBe(1);
    expect(result.summary.priorityCounts.high).toBe(1);
    expect(result.summary.priorityCounts.urgent).toBe(1);
  });
});
