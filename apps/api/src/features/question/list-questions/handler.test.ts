import { QuestionId } from '@api/features/quiz/domain/value-objects/Ids';
import type { LoggerPort } from '@api/shared/logger/LoggerPort';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  IQuestionRepository,
  QuestionSummary,
} from '../domain/repositories/IQuestionRepository';
import { PremiumAccessService } from '../domain/services';
import { listQuestionsHandler } from './handler';

describe('listQuestionsHandler', () => {
  let mockQuestionRepository: {
    findQuestions: ReturnType<typeof vi.fn>;
    findQuestionById: ReturnType<typeof vi.fn>;
    getQuestionStats: ReturnType<typeof vi.fn>;
    createQuestion: ReturnType<typeof vi.fn>;
    updateQuestion: ReturnType<typeof vi.fn>;
    findQuestionWithDetails: ReturnType<typeof vi.fn>;
  };
  let mockLogger: LoggerPort;
  let premiumAccessService: PremiumAccessService;

  beforeEach(() => {
    // Create premium access service instance
    premiumAccessService = new PremiumAccessService();
    // Setup repository mock
    mockQuestionRepository = {
      findQuestions: vi.fn(),
      findQuestionById: vi.fn(),
      getQuestionStats: vi.fn(),
      createQuestion: vi.fn(),
      updateQuestion: vi.fn(),
      findQuestionWithDetails: vi.fn(),
    };

    // Setup logger mock
    mockLogger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    };
  });

  describe('validateDifficulty logging', () => {
    it('should log warning when invalid difficulty is encountered', async () => {
      // Arrange - Mock repository returns invalid difficulty
      const mockQuestions: QuestionSummary[] = [
        {
          questionId: QuestionId.of('test-id-1'),
          questionText: 'Test question',
          questionType: 'multiple_choice',
          examTypes: ['CCNA'],
          categories: ['Network'],
          difficulty: 'InvalidDifficulty', // Invalid value simulating data corruption
          isPremium: false,
          hasImages: false,
          optionCount: 2,
          tags: [],
          createdAt: new Date(),
        },
      ];

      mockQuestionRepository.findQuestions.mockResolvedValue({
        questions: mockQuestions,
        pagination: {
          total: 1,
          limit: 10,
          offset: 0,
          hasNext: false,
        },
      });

      // Act
      const result = await listQuestionsHandler(
        {
          limit: '10',
          offset: '0',
          activeOnly: 'false',
        },
        mockQuestionRepository as IQuestionRepository,
        mockLogger,
        premiumAccessService,
        false
      );

      // Assert
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.questions[0].difficulty).toBe('Mixed'); // Should default to Mixed
      }

      // Verify logger was called with warning
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Invalid question difficulty detected - data quality issue',
        expect.objectContaining({
          invalidDifficulty: 'InvalidDifficulty',
          defaultedTo: 'Mixed',
          questionId: 'test-id-1',
          validDifficulties: ['Beginner', 'Intermediate', 'Advanced', 'Mixed'],
          dataIntegrityAlert: true,
        })
      );
    });

    it('should not log warning for valid difficulties', async () => {
      // Arrange - Mock repository returns valid difficulties
      const validDifficulties = ['Beginner', 'Intermediate', 'Advanced', 'Mixed'];
      const mockQuestions: QuestionSummary[] = validDifficulties.map((difficulty, index) => ({
        questionId: QuestionId.of(`test-id-${index}`),
        questionText: `Test question ${difficulty}`,
        questionType: 'multiple_choice' as const,
        examTypes: ['CCNA'],
        categories: ['Network'],
        difficulty,
        isPremium: false,
        hasImages: false,
        optionCount: 2,
        tags: [],
        createdAt: new Date(),
      }));

      mockQuestionRepository.findQuestions.mockResolvedValue({
        questions: mockQuestions,
        pagination: {
          total: 4,
          limit: 10,
          offset: 0,
          hasNext: false,
        },
      });

      // Act
      const result = await listQuestionsHandler(
        {
          limit: '10',
          offset: '0',
          activeOnly: 'false',
        },
        mockQuestionRepository as IQuestionRepository,
        mockLogger,
        premiumAccessService,
        false
      );

      // Assert
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.questions).toHaveLength(4);
      }

      // Verify logger was NOT called with warning
      expect(mockLogger.warn).not.toHaveBeenCalled();
    });
  });

  describe('basic functionality', () => {
    it('should handle empty repository', async () => {
      // Arrange
      mockQuestionRepository.findQuestions.mockResolvedValue({
        questions: [],
        pagination: {
          total: 0,
          limit: 10,
          offset: 0,
          hasNext: false,
        },
      });

      // Act
      const result = await listQuestionsHandler(
        {
          limit: '10',
          offset: '0',
        },
        mockQuestionRepository as IQuestionRepository,
        mockLogger,
        premiumAccessService,
        false
      );

      // Assert
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.questions).toEqual([]);
        expect(result.data.pagination).toEqual({
          total: 0,
          limit: 10,
          offset: 0,
          hasNext: false,
        });
      }
    });

    it('should validate input parameters', async () => {
      // Act
      const result = await listQuestionsHandler(
        {
          limit: 'invalid', // Invalid type
          offset: '0',
        },
        mockQuestionRepository as IQuestionRepository,
        mockLogger,
        premiumAccessService,
        false
      );

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeDefined();
      }
    });

    it('should handle repository errors gracefully', async () => {
      // Arrange
      const repositoryError = new Error('Database connection failed');
      mockQuestionRepository.findQuestions.mockRejectedValue(repositoryError);

      // Act
      const result = await listQuestionsHandler(
        {
          limit: '10',
          offset: '0',
        },
        mockQuestionRepository as IQuestionRepository,
        mockLogger,
        premiumAccessService,
        false
      );

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe(repositoryError);
      }
    });

    it('should filter premium content for unauthenticated users', async () => {
      // Arrange
      mockQuestionRepository.findQuestions.mockResolvedValue({
        questions: [],
        pagination: {
          total: 0,
          limit: 10,
          offset: 0,
          hasNext: false,
        },
      });

      // Act
      const result = await listQuestionsHandler(
        {
          limit: '10',
          offset: '0',
          includePremium: 'true', // User requests premium
        },
        mockQuestionRepository as IQuestionRepository,
        mockLogger,
        premiumAccessService,
        false // Not authenticated
      );

      // Assert
      expect(result.success).toBe(true);
      // Verify that repository was called with includePremium = false
      expect(mockQuestionRepository.findQuestions).toHaveBeenCalledWith(
        expect.objectContaining({
          includePremium: false, // Should be false for unauthenticated users
        }),
        expect.any(Object)
      );
    });
  });
});
