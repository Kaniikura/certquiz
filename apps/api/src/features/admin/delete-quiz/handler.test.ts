/**
 * Delete quiz handler tests
 * @fileoverview Tests for admin quiz deletion with cascading cleanup
 */

import type { QuizSession } from '@api/features/quiz/domain/aggregates/QuizSession';
import type { IQuizRepository } from '@api/features/quiz/domain/repositories/IQuizRepository';
import { QuizState } from '@api/features/quiz/domain/value-objects/QuizState';
import type { IUnitOfWork } from '@api/infra/db/IUnitOfWork';
import { NotFoundError, ValidationError } from '@api/shared/errors';
import { QUIZ_REPO_TOKEN, type RepositoryToken } from '@api/shared/types/RepositoryToken';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AdminPermissionError } from '../shared/admin-errors';
import type { DeleteQuizParams } from './dto';
import { deleteQuizHandler } from './handler';

// Mock quiz session that implements the required QuizSession interface
interface MockQuizSession {
  id: string;
  userId: string;
  state: QuizState;
  startedAt: Date;
  completedAt?: Date;
}

describe('deleteQuizHandler', () => {
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

  it('should delete completed quiz successfully', async () => {
    // Arrange
    const mockQuiz: MockQuizSession = {
      id: '550e8400-e29b-41d4-a716-446655440000',
      userId: '550e8400-e29b-41d4-a716-446655440001',
      state: QuizState.Completed,
      startedAt: new Date('2025-01-01T10:00:00Z'),
      completedAt: new Date('2025-01-01T10:30:00Z'),
    };

    vi.mocked(mockQuizRepo.findById).mockResolvedValue(mockQuiz as unknown as QuizSession);
    vi.mocked(mockQuizRepo.deleteWithCascade).mockResolvedValue(undefined);

    const params: DeleteQuizParams = {
      quizId: '550e8400-e29b-41d4-a716-446655440000',
      deletedBy: '550e8400-e29b-41d4-a716-446655440002',
      reason: 'Inappropriate content reported by users',
    };

    // Act
    const result = await deleteQuizHandler(params, mockUnitOfWork);

    // Assert
    expect(result.success).toBe(true);
    expect(result.quizId).toBe('550e8400-e29b-41d4-a716-446655440000');
    expect(result.previousState).toBe('COMPLETED');
    expect(result.deletedBy).toBe('550e8400-e29b-41d4-a716-446655440002');
    expect(result.reason).toBe('Inappropriate content reported by users');
    expect(result.deletedAt).toBeInstanceOf(Date);

    // Verify repository calls
    expect(mockQuizRepo.findById).toHaveBeenCalledWith('550e8400-e29b-41d4-a716-446655440000');
    expect(mockQuizRepo.deleteWithCascade).toHaveBeenCalledWith(
      '550e8400-e29b-41d4-a716-446655440000'
    );
  });

  it('should delete expired quiz successfully', async () => {
    // Arrange
    const mockQuiz: MockQuizSession = {
      id: '550e8400-e29b-41d4-a716-446655440003',
      userId: '550e8400-e29b-41d4-a716-446655440004',
      state: QuizState.Expired,
      startedAt: new Date('2025-01-01T09:00:00Z'),
      completedAt: new Date('2025-01-01T09:30:00Z'),
    };

    vi.mocked(mockQuizRepo.findById).mockResolvedValue(mockQuiz as unknown as QuizSession);
    vi.mocked(mockQuizRepo.deleteWithCascade).mockResolvedValue(undefined);

    const params: DeleteQuizParams = {
      quizId: '550e8400-e29b-41d4-a716-446655440003',
      deletedBy: '550e8400-e29b-41d4-a716-446655440005',
      reason: 'System cleanup - expired quiz',
    };

    // Act
    const result = await deleteQuizHandler(params, mockUnitOfWork);

    // Assert
    expect(result.success).toBe(true);
    expect(result.previousState).toBe('EXPIRED');
    expect(result.reason).toBe('System cleanup - expired quiz');
  });

  it('should reject deletion of active quiz', async () => {
    // Arrange
    const mockQuiz: MockQuizSession = {
      id: '550e8400-e29b-41d4-a716-446655440006',
      userId: '550e8400-e29b-41d4-a716-446655440007',
      state: QuizState.InProgress,
      startedAt: new Date('2025-01-01T08:00:00Z'),
    };

    vi.mocked(mockQuizRepo.findById).mockResolvedValue(mockQuiz as unknown as QuizSession);

    const params: DeleteQuizParams = {
      quizId: '550e8400-e29b-41d4-a716-446655440006',
      deletedBy: '550e8400-e29b-41d4-a716-446655440008',
      reason: 'Admin requested deletion',
    };

    // Act & Assert
    await expect(deleteQuizHandler(params, mockUnitOfWork)).rejects.toThrow(AdminPermissionError);
    await expect(deleteQuizHandler(params, mockUnitOfWork)).rejects.toThrow(
      'Cannot delete active quiz session. Only completed or expired quizzes can be deleted.'
    );

    // Verify repository calls - should not attempt deletion
    expect(mockQuizRepo.findById).toHaveBeenCalledWith('550e8400-e29b-41d4-a716-446655440006');
    expect(mockQuizRepo.deleteWithCascade).not.toHaveBeenCalled();
  });

  it('should fail when quiz not found', async () => {
    // Arrange
    vi.mocked(mockQuizRepo.findById).mockResolvedValue(null);

    const params: DeleteQuizParams = {
      quizId: '550e8400-e29b-41d4-a716-446655440009',
      deletedBy: '550e8400-e29b-41d4-a716-446655440010',
      reason: 'Admin deletion request',
    };

    // Act & Assert
    await expect(deleteQuizHandler(params, mockUnitOfWork)).rejects.toThrow(NotFoundError);
    await expect(deleteQuizHandler(params, mockUnitOfWork)).rejects.toThrow(
      'Quiz session not found'
    );

    // Verify repository calls - should not attempt deletion
    expect(mockQuizRepo.findById).toHaveBeenCalledWith('550e8400-e29b-41d4-a716-446655440009');
    expect(mockQuizRepo.deleteWithCascade).not.toHaveBeenCalled();
  });

  it('should require deletion reason', async () => {
    // Arrange
    const params: DeleteQuizParams = {
      quizId: '550e8400-e29b-41d4-a716-446655440011',
      deletedBy: '550e8400-e29b-41d4-a716-446655440012',
      reason: '', // Empty reason should fail validation
    };

    // Act & Assert
    await expect(deleteQuizHandler(params, mockUnitOfWork)).rejects.toThrow(ValidationError);
    await expect(deleteQuizHandler(params, mockUnitOfWork)).rejects.toThrow(
      'Deletion reason is required and must be at least 10 characters'
    );
  });

  it('should require minimum reason length', async () => {
    // Arrange
    const params: DeleteQuizParams = {
      quizId: '550e8400-e29b-41d4-a716-446655440013',
      deletedBy: '550e8400-e29b-41d4-a716-446655440014',
      reason: 'Short', // Too short reason should fail validation
    };

    // Act & Assert
    await expect(deleteQuizHandler(params, mockUnitOfWork)).rejects.toThrow(ValidationError);
    await expect(deleteQuizHandler(params, mockUnitOfWork)).rejects.toThrow(
      'Deletion reason is required and must be at least 10 characters'
    );
  });

  it('should validate quiz ID format', async () => {
    // Arrange
    const params: DeleteQuizParams = {
      quizId: 'invalid-uuid-format',
      deletedBy: '550e8400-e29b-41d4-a716-446655440015',
      reason: 'Valid deletion reason for testing',
    };

    // Act & Assert
    await expect(deleteQuizHandler(params, mockUnitOfWork)).rejects.toThrow(ValidationError);
    await expect(deleteQuizHandler(params, mockUnitOfWork)).rejects.toThrow(
      'Invalid quiz ID format'
    );
  });

  it('should validate deletedBy user ID format', async () => {
    // Arrange
    const params: DeleteQuizParams = {
      quizId: '550e8400-e29b-41d4-a716-446655440016',
      deletedBy: 'invalid-admin-uuid',
      reason: 'Valid deletion reason for testing',
    };

    // Act & Assert
    await expect(deleteQuizHandler(params, mockUnitOfWork)).rejects.toThrow(ValidationError);
    await expect(deleteQuizHandler(params, mockUnitOfWork)).rejects.toThrow(
      'Invalid admin user ID format'
    );
  });

  it('should return proper audit metadata', async () => {
    // Arrange
    const beforeDeletion = new Date();

    const mockQuiz: MockQuizSession = {
      id: '550e8400-e29b-41d4-a716-446655440017',
      userId: '550e8400-e29b-41d4-a716-446655440018',
      state: QuizState.Completed,
      startedAt: new Date('2025-01-01T07:00:00Z'),
      completedAt: new Date('2025-01-01T07:30:00Z'),
    };

    vi.mocked(mockQuizRepo.findById).mockResolvedValue(mockQuiz as unknown as QuizSession);
    vi.mocked(mockQuizRepo.deleteWithCascade).mockResolvedValue(undefined);

    const params: DeleteQuizParams = {
      quizId: '550e8400-e29b-41d4-a716-446655440017',
      deletedBy: '550e8400-e29b-41d4-a716-446655440019',
      reason: 'Audit trail testing with comprehensive metadata',
    };

    // Act
    const result = await deleteQuizHandler(params, mockUnitOfWork);
    const afterDeletion = new Date();

    // Assert audit metadata
    expect(result.success).toBe(true);
    expect(result.quizId).toBe('550e8400-e29b-41d4-a716-446655440017');
    expect(result.previousState).toBe('COMPLETED');
    expect(result.deletedBy).toBe('550e8400-e29b-41d4-a716-446655440019');
    expect(result.reason).toBe('Audit trail testing with comprehensive metadata');
    expect(result.deletedAt).toBeInstanceOf(Date);
    expect(result.deletedAt.getTime()).toBeGreaterThanOrEqual(beforeDeletion.getTime());
    expect(result.deletedAt.getTime()).toBeLessThanOrEqual(afterDeletion.getTime());
  });

  it('should handle cascading deletion errors gracefully', async () => {
    // Arrange
    const mockQuiz: MockQuizSession = {
      id: '550e8400-e29b-41d4-a716-446655440020',
      userId: '550e8400-e29b-41d4-a716-446655440021',
      state: QuizState.Completed,
      startedAt: new Date('2025-01-01T06:00:00Z'),
      completedAt: new Date('2025-01-01T06:30:00Z'),
    };

    vi.mocked(mockQuizRepo.findById).mockResolvedValue(mockQuiz as unknown as QuizSession);
    vi.mocked(mockQuizRepo.deleteWithCascade).mockRejectedValue(
      new Error('Foreign key constraint violation')
    );

    const params: DeleteQuizParams = {
      quizId: '550e8400-e29b-41d4-a716-446655440020',
      deletedBy: '550e8400-e29b-41d4-a716-446655440022',
      reason: 'Testing cascading deletion error handling',
    };

    // Act & Assert
    await expect(deleteQuizHandler(params, mockUnitOfWork)).rejects.toThrow(
      'Failed to delete quiz session: Foreign key constraint violation'
    );

    // Verify repository calls
    expect(mockQuizRepo.findById).toHaveBeenCalledWith('550e8400-e29b-41d4-a716-446655440020');
    expect(mockQuizRepo.deleteWithCascade).toHaveBeenCalledWith(
      '550e8400-e29b-41d4-a716-446655440020'
    );
  });
});
