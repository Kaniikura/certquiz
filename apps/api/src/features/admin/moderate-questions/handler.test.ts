/**
 * Moderate Questions Handler Tests
 * @fileoverview TDD tests for question moderation functionality
 */

import { QuestionStatus } from '@api/features/question/domain/entities/Question';
import type { IQuestionRepository } from '@api/features/question/domain/repositories/IQuestionRepository';
import { InvalidQuestionDataError } from '@api/features/question/shared/errors';
import type { QuestionId } from '@api/features/quiz/domain/value-objects/Ids';
import type { IUnitOfWork } from '@api/infra/db/IUnitOfWork';
import { NotFoundError, ValidationError } from '@api/shared/errors';
import { QUESTION_REPO_TOKEN, type RepositoryToken } from '@api/shared/types/RepositoryToken';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ModerateQuestionParams, ModerationAction } from './dto';
import { moderateQuestionHandler } from './handler';

describe('moderateQuestionHandler', () => {
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

  describe('approve action', () => {
    it('should approve question successfully', async () => {
      // Arrange
      vi.mocked(mockQuestionRepo.updateStatus).mockResolvedValue(undefined);

      const params: ModerateQuestionParams = {
        questionId: '550e8400-e29b-41d4-a716-446655440000' as QuestionId,
        action: 'approve',
        moderatedBy: '550e8400-e29b-41d4-a716-446655440001',
      };

      // Act
      const result = await moderateQuestionHandler(params, mockUnitOfWork);

      // Assert
      expect(result.success).toBe(true);
      expect(result.questionId).toBe('550e8400-e29b-41d4-a716-446655440000');
      expect(result.action).toBe('approve');
      expect(result.newStatus).toBe('APPROVED');
      expect(result.moderatedBy).toBe('550e8400-e29b-41d4-a716-446655440001');
      expect(result.moderatedAt).toBeInstanceOf(Date);
      expect(result.feedback).toBeUndefined();

      expect(mockQuestionRepo.updateStatus).toHaveBeenCalledWith(
        '550e8400-e29b-41d4-a716-446655440000',
        QuestionStatus.ACTIVE,
        '550e8400-e29b-41d4-a716-446655440001',
        undefined
      );
    });

    it('should approve question without requiring feedback', async () => {
      // Arrange
      vi.mocked(mockQuestionRepo.updateStatus).mockResolvedValue(undefined);

      const params: ModerateQuestionParams = {
        questionId: '550e8400-e29b-41d4-a716-446655440002' as QuestionId,
        action: 'approve',
        moderatedBy: '550e8400-e29b-41d4-a716-446655440003',
        feedback: 'Optional feedback for approval',
      };

      // Act
      const result = await moderateQuestionHandler(params, mockUnitOfWork);

      // Assert
      expect(result.success).toBe(true);
      expect(result.feedback).toBe('Optional feedback for approval');
    });
  });

  describe('reject action', () => {
    it('should reject question with feedback successfully', async () => {
      // Arrange
      vi.mocked(mockQuestionRepo.updateStatus).mockResolvedValue(undefined);

      const params: ModerateQuestionParams = {
        questionId: '550e8400-e29b-41d4-a716-446655440004' as QuestionId,
        action: 'reject',
        moderatedBy: '550e8400-e29b-41d4-a716-446655440005',
        feedback: 'Question contains inappropriate content and needs revision',
      };

      // Act
      const result = await moderateQuestionHandler(params, mockUnitOfWork);

      // Assert
      expect(result.success).toBe(true);
      expect(result.questionId).toBe('550e8400-e29b-41d4-a716-446655440004');
      expect(result.action).toBe('reject');
      expect(result.newStatus).toBe('REJECTED');
      expect(result.moderatedBy).toBe('550e8400-e29b-41d4-a716-446655440005');
      expect(result.feedback).toBe('Question contains inappropriate content and needs revision');

      expect(mockQuestionRepo.updateStatus).toHaveBeenCalledWith(
        '550e8400-e29b-41d4-a716-446655440004',
        QuestionStatus.ARCHIVED,
        '550e8400-e29b-41d4-a716-446655440005',
        'Question contains inappropriate content and needs revision'
      );
    });

    it('should require feedback for rejection', async () => {
      // Arrange
      const params: ModerateQuestionParams = {
        questionId: '550e8400-e29b-41d4-a716-446655440006' as QuestionId,
        action: 'reject',
        moderatedBy: '550e8400-e29b-41d4-a716-446655440007',
        // No feedback provided
      };

      // Act & Assert
      await expect(moderateQuestionHandler(params, mockUnitOfWork)).rejects.toThrow(
        ValidationError
      );
      await expect(moderateQuestionHandler(params, mockUnitOfWork)).rejects.toThrow(
        'Feedback is required for reject action'
      );

      expect(mockQuestionRepo.updateStatus).not.toHaveBeenCalled();
    });

    it('should require minimum feedback length for rejection', async () => {
      // Arrange
      const params: ModerateQuestionParams = {
        questionId: '550e8400-e29b-41d4-a716-446655440008' as QuestionId,
        action: 'reject',
        moderatedBy: '550e8400-e29b-41d4-a716-446655440009',
        feedback: 'Too short', // Less than 10 characters
      };

      // Act & Assert
      await expect(moderateQuestionHandler(params, mockUnitOfWork)).rejects.toThrow(
        ValidationError
      );
      await expect(moderateQuestionHandler(params, mockUnitOfWork)).rejects.toThrow(
        'Feedback must be at least 10 characters long'
      );

      expect(mockQuestionRepo.updateStatus).not.toHaveBeenCalled();
    });
  });

  describe('request_changes action', () => {
    it('should request changes with feedback successfully', async () => {
      // Arrange
      vi.mocked(mockQuestionRepo.updateStatus).mockResolvedValue(undefined);

      const params: ModerateQuestionParams = {
        questionId: '550e8400-e29b-41d4-a716-446655440010' as QuestionId,
        action: 'request_changes',
        moderatedBy: '550e8400-e29b-41d4-a716-446655440011',
        feedback: 'Please clarify the question wording and add more detailed explanations',
      };

      // Act
      const result = await moderateQuestionHandler(params, mockUnitOfWork);

      // Assert
      expect(result.success).toBe(true);
      expect(result.questionId).toBe('550e8400-e29b-41d4-a716-446655440010');
      expect(result.action).toBe('request_changes');
      expect(result.newStatus).toBe('PENDING'); // Stays in draft/pending
      expect(result.moderatedBy).toBe('550e8400-e29b-41d4-a716-446655440011');
      expect(result.feedback).toBe(
        'Please clarify the question wording and add more detailed explanations'
      );

      expect(mockQuestionRepo.updateStatus).toHaveBeenCalledWith(
        '550e8400-e29b-41d4-a716-446655440010',
        QuestionStatus.DRAFT, // Stays draft for revision
        '550e8400-e29b-41d4-a716-446655440011',
        'Please clarify the question wording and add more detailed explanations'
      );
    });

    it('should require feedback for request_changes', async () => {
      // Arrange
      const params: ModerateQuestionParams = {
        questionId: '550e8400-e29b-41d4-a716-446655440012' as QuestionId,
        action: 'request_changes',
        moderatedBy: '550e8400-e29b-41d4-a716-446655440013',
        // No feedback provided
      };

      // Act & Assert
      await expect(moderateQuestionHandler(params, mockUnitOfWork)).rejects.toThrow(
        ValidationError
      );
      await expect(moderateQuestionHandler(params, mockUnitOfWork)).rejects.toThrow(
        'Feedback is required for request_changes action'
      );

      expect(mockQuestionRepo.updateStatus).not.toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    it('should handle question not found', async () => {
      // Arrange
      vi.mocked(mockQuestionRepo.updateStatus).mockRejectedValue(
        new NotFoundError('Question not found')
      );

      const params: ModerateQuestionParams = {
        questionId: '550e8400-e29b-41d4-a716-446655440014' as QuestionId,
        action: 'approve',
        moderatedBy: '550e8400-e29b-41d4-a716-446655440015',
      };

      // Act & Assert
      await expect(moderateQuestionHandler(params, mockUnitOfWork)).rejects.toThrow(NotFoundError);
      await expect(moderateQuestionHandler(params, mockUnitOfWork)).rejects.toThrow(
        'Question not found'
      );
    });

    it('should handle invalid question status', async () => {
      // Arrange
      vi.mocked(mockQuestionRepo.updateStatus).mockRejectedValue(
        new InvalidQuestionDataError(
          'Cannot moderate question with status ACTIVE. Only DRAFT questions can be moderated.'
        )
      );

      const params: ModerateQuestionParams = {
        questionId: '550e8400-e29b-41d4-a716-446655440016' as QuestionId,
        action: 'approve',
        moderatedBy: '550e8400-e29b-41d4-a716-446655440017',
      };

      // Act & Assert
      await expect(moderateQuestionHandler(params, mockUnitOfWork)).rejects.toThrow(
        InvalidQuestionDataError
      );
      await expect(moderateQuestionHandler(params, mockUnitOfWork)).rejects.toThrow(
        'Cannot moderate question with status ACTIVE'
      );
    });

    it('should validate question ID format', async () => {
      // Arrange
      const params = {
        questionId: 'invalid-uuid-format',
        action: 'approve' as const,
        moderatedBy: '550e8400-e29b-41d4-a716-446655440018',
      };

      // Act & Assert
      // @ts-expect-error Testing invalid input for validation
      await expect(moderateQuestionHandler(params, mockUnitOfWork)).rejects.toThrow(
        ValidationError
      );
      // @ts-expect-error Testing invalid input for validation
      await expect(moderateQuestionHandler(params, mockUnitOfWork)).rejects.toThrow(
        'questionId: Must be a valid UUID'
      );
    });

    it('should validate moderatedBy user ID format', async () => {
      // Arrange
      const params = {
        questionId: '550e8400-e29b-41d4-a716-446655440019' as QuestionId,
        action: 'approve' as const,
        moderatedBy: 'invalid-admin-uuid',
      };

      // Act & Assert
      await expect(moderateQuestionHandler(params, mockUnitOfWork)).rejects.toThrow(
        ValidationError
      );
      await expect(moderateQuestionHandler(params, mockUnitOfWork)).rejects.toThrow(
        'moderatedBy: Must be a valid UUID'
      );
    });

    it('should validate action values', async () => {
      // Arrange
      const params = {
        questionId: '550e8400-e29b-41d4-a716-446655440020' as QuestionId,
        action: 'invalid_action' as ModerationAction,
        moderatedBy: '550e8400-e29b-41d4-a716-446655440021',
      };

      // Act & Assert
      await expect(moderateQuestionHandler(params, mockUnitOfWork)).rejects.toThrow(
        ValidationError
      );
      await expect(moderateQuestionHandler(params, mockUnitOfWork)).rejects.toThrow(
        'Action must be approve, reject, or request_changes'
      );
    });

    it('should return proper audit metadata', async () => {
      // Arrange
      const beforeModeration = new Date();
      vi.mocked(mockQuestionRepo.updateStatus).mockResolvedValue(undefined);

      const params: ModerateQuestionParams = {
        questionId: '550e8400-e29b-41d4-a716-446655440022' as QuestionId,
        action: 'approve',
        moderatedBy: '550e8400-e29b-41d4-a716-446655440023',
      };

      // Act
      const result = await moderateQuestionHandler(params, mockUnitOfWork);
      const afterModeration = new Date();

      // Assert audit metadata
      expect(result.success).toBe(true);
      expect(result.questionId).toBe('550e8400-e29b-41d4-a716-446655440022');
      expect(result.moderatedBy).toBe('550e8400-e29b-41d4-a716-446655440023');
      expect(result.action).toBe('approve');
      expect(result.moderatedAt).toBeInstanceOf(Date);
      expect(result.moderatedAt.getTime()).toBeGreaterThanOrEqual(beforeModeration.getTime());
      expect(result.moderatedAt.getTime()).toBeLessThanOrEqual(afterModeration.getTime());
    });
  });
});
