/**
 * Start quiz handler tests
 * @fileoverview TDD tests for start quiz business logic
 */

import type { UserId } from '@api/features/auth/domain/value-objects/UserId';
import { ValidationError } from '@api/shared/errors';
import { testIds } from '@api/test-support/utils/id-generators';
import { TestClock } from '@api/test-support/utils/TestClock';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { QuizSession } from '../domain/aggregates/QuizSession';
import type { QuestionId } from '../domain/value-objects/Ids';
import { QuizConfig } from '../domain/value-objects/QuizConfig';
import type { QuizStateValue } from '../infrastructure/drizzle/schema/enums';
import type { StartQuizRequest, StartQuizResponse } from './dto';
import { startQuizHandler } from './handler';

describe('startQuizHandler', () => {
  let mockQuizRepository: {
    findById: ReturnType<typeof vi.fn>;
    save: ReturnType<typeof vi.fn>;
    findExpiredSessions: ReturnType<typeof vi.fn>;
    findActiveByUser: ReturnType<typeof vi.fn>;
    countTotalSessions: ReturnType<typeof vi.fn>;
    countActiveSessions: ReturnType<typeof vi.fn>;
    getAverageScore: ReturnType<typeof vi.fn>;
    findAllForAdmin: ReturnType<typeof vi.fn>;
    deleteWithCascade: ReturnType<typeof vi.fn>;
  };
  let mockQuestionService: {
    getQuestionsForQuiz: ReturnType<typeof vi.fn>;
  };
  let clock: TestClock;
  let userId: UserId;
  let questionIds: QuestionId[];

  beforeEach(() => {
    // Setup mocks
    mockQuizRepository = {
      findById: vi.fn(),
      save: vi.fn(),
      findExpiredSessions: vi.fn(),
      findActiveByUser: vi.fn(),
      countTotalSessions: vi.fn().mockResolvedValue(0),
      countActiveSessions: vi.fn().mockResolvedValue(0),
      getAverageScore: vi.fn().mockResolvedValue(0),
      findAllForAdmin: vi.fn(),
      deleteWithCascade: vi.fn(),
    };

    mockQuestionService = {
      getQuestionsForQuiz: vi.fn(),
    };

    // Setup test data
    clock = new TestClock(new Date('2025-01-20T10:00:00Z'));
    userId = testIds.userId();
    questionIds = testIds.questionIds(3, 'test-q');

    // Default mock implementations
    mockQuestionService.getQuestionsForQuiz.mockResolvedValue(questionIds);
    mockQuizRepository.findActiveByUser.mockResolvedValue(null); // No active session
    mockQuizRepository.save.mockResolvedValue(undefined);
  });

  describe('successful quiz start', () => {
    it('should start a new quiz session with valid configuration', async () => {
      // Arrange
      const request: StartQuizRequest = {
        examType: 'CCNA',
        category: 'NETWORKING',
        questionCount: 3,
        timeLimit: 1800, // 30 minutes
        difficulty: 'INTERMEDIATE',
        enforceSequentialAnswering: true,
        requireAllAnswers: false,
      };

      // Act
      const result = await startQuizHandler(
        request,
        userId,
        mockQuizRepository,
        mockQuestionService,
        clock
      );

      // Assert
      expect(result.success).toBe(true);
      if (result.success) {
        const response = result.data as StartQuizResponse;
        expect(response.sessionId).toBeDefined();
        expect(response.config.questionCount).toBe(3);
        expect(response.config.timeLimit).toBe(1800);
        expect(response.questionIds).toEqual(questionIds);
        expect(response.startedAt).toEqual(clock.now());
        expect(response.expiresAt).toEqual(new Date(clock.now().getTime() + 1800 * 1000));
      }

      // Verify repository interactions
      expect(mockQuizRepository.findActiveByUser).toHaveBeenCalledWith(userId);
      expect(mockQuestionService.getQuestionsForQuiz).toHaveBeenCalledWith({
        examType: 'CCNA',
        category: 'NETWORKING',
        questionCount: 3,
        difficulty: 'INTERMEDIATE',
      });
      expect(mockQuizRepository.save).toHaveBeenCalledTimes(1);

      // Verify the saved quiz session
      const savedSession = mockQuizRepository.save.mock.calls[0][0] as QuizSession;
      expect(savedSession.userId).toBe(userId);
      expect(savedSession.config.questionCount).toBe(3);
      expect(savedSession.state).toBe('IN_PROGRESS' satisfies QuizStateValue);
    });

    it('should handle quiz without time limit', async () => {
      // Arrange
      const request: StartQuizRequest = {
        examType: 'CCNP',
        questionCount: 5,
        // No timeLimit specified
      };

      // Setup mock for this specific test
      const testQuestionIds = testIds.questionIds(5, 'no-time-limit');
      mockQuestionService.getQuestionsForQuiz.mockResolvedValue(testQuestionIds);

      // Act
      const result = await startQuizHandler(
        request,
        userId,
        mockQuizRepository,
        mockQuestionService,
        clock
      );

      // Assert
      expect(result.success).toBe(true);
      if (result.success) {
        const response = result.data as StartQuizResponse;
        expect(response.config.timeLimit).toBeNull();
        expect(response.expiresAt).toEqual(
          new Date(clock.now().getTime() + QuizConfig.DEFAULT_FALLBACK_LIMIT_SECONDS * 1000)
        );
      }
    });
  });

  describe('validation errors', () => {
    it('should fail with invalid question count', async () => {
      // Arrange
      const request = {
        examType: 'CCNA',
        questionCount: 0, // Invalid
      };

      // Act
      const result = await startQuizHandler(
        request,
        userId,
        mockQuizRepository,
        mockQuestionService,
        clock
      );

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(ValidationError);
      }
    });

    it('should fail with invalid time limit', async () => {
      // Arrange
      const request = {
        examType: 'CCNA',
        questionCount: 10,
        timeLimit: 30, // Less than 60 seconds minimum
      };

      // Act
      const result = await startQuizHandler(
        request,
        userId,
        mockQuizRepository,
        mockQuestionService,
        clock
      );

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(ValidationError);
      }
    });
  });

  describe('business rule violations', () => {
    it('should fail when user has active session', async () => {
      // Arrange
      const activeQuestionIds = testIds.questionIds(5, 'active-q');

      const configResult = QuizConfig.create({ examType: 'CCNA', questionCount: 5 });
      if (!configResult.success) throw new Error('Test setup failed');

      const sessionResult = QuizSession.startNew(
        userId,
        configResult.data,
        activeQuestionIds,
        clock
      );
      if (!sessionResult.success) throw new Error('Test setup failed');

      const activeSession = sessionResult.data;

      mockQuizRepository.findActiveByUser.mockResolvedValue(activeSession);

      const request: StartQuizRequest = {
        examType: 'CCNP',
        questionCount: 3,
      };

      // Act
      const result = await startQuizHandler(
        request,
        userId,
        mockQuizRepository,
        mockQuestionService,
        clock
      );

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toContain('active session');
      }
    });

    it('should fail when insufficient questions available', async () => {
      // Arrange
      mockQuestionService.getQuestionsForQuiz.mockResolvedValue([
        testIds.questionId('insufficient-1'),
      ]); // Only 1 question

      const request: StartQuizRequest = {
        examType: 'CCNA',
        questionCount: 5, // Requesting 5 but only 1 available
      };

      // Act
      const result = await startQuizHandler(
        request,
        userId,
        mockQuizRepository,
        mockQuestionService,
        clock
      );

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toContain('Insufficient questions');
      }
    });
  });

  describe('repository errors', () => {
    it('should handle repository save failure', async () => {
      // Arrange
      mockQuizRepository.save.mockRejectedValue(new Error('Database connection failed'));

      const request: StartQuizRequest = {
        examType: 'CCNA',
        questionCount: 3,
      };

      // Act
      const result = await startQuizHandler(
        request,
        userId,
        mockQuizRepository,
        mockQuestionService,
        clock
      );

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toContain('Failed to save');
      }
    });

    it('should handle question service failure', async () => {
      // Arrange
      mockQuestionService.getQuestionsForQuiz.mockRejectedValue(
        new Error('Question service unavailable')
      );

      const request: StartQuizRequest = {
        examType: 'CCNA',
        questionCount: 3,
      };

      // Act
      const result = await startQuizHandler(
        request,
        userId,
        mockQuizRepository,
        mockQuestionService,
        clock
      );

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toContain('Failed to fetch questions');
      }
    });
  });
});
