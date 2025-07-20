/**
 * Submit answer handler tests
 * @fileoverview TDD tests for submit answer business logic
 */

import { ValidationError } from '@api/shared/errors';
import { TestClock, testIds } from '@api/test-support';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { QuizSession } from '../domain/aggregates/QuizSession';
import type { OptionId, QuestionId, QuizSessionId, UserId } from '../domain/value-objects/Ids';
import { QuestionReference } from '../domain/value-objects/QuestionReference';
import { QuizConfig } from '../domain/value-objects/QuizConfig';
import { QuizState } from '../domain/value-objects/QuizState';
import type { SubmitAnswerRequest, SubmitAnswerResponse } from './dto';
import { submitAnswerHandler } from './handler';

describe('submitAnswerHandler', () => {
  let mockQuizRepository: {
    findById: ReturnType<typeof vi.fn>;
    save: ReturnType<typeof vi.fn>;
    findExpiredSessions: ReturnType<typeof vi.fn>;
    findActiveByUser: ReturnType<typeof vi.fn>;
  };
  let mockQuestionService: {
    getQuestionReference: ReturnType<typeof vi.fn>;
  };
  let clock: TestClock;
  let userId: UserId;
  let sessionId: QuizSessionId;
  let questionIds: QuestionId[];
  let optionIds: OptionId[];
  let quizSession: QuizSession;

  beforeEach(async () => {
    // Setup mocks
    mockQuizRepository = {
      findById: vi.fn(),
      save: vi.fn(),
      findExpiredSessions: vi.fn(),
      findActiveByUser: vi.fn(),
    };

    mockQuestionService = {
      getQuestionReference: vi.fn(),
    };

    // Setup test data
    clock = new TestClock(new Date('2025-01-20T10:00:00Z'));
    userId = testIds.userId();
    sessionId = testIds.quizSessionId();
    questionIds = testIds.questionIds(3, 'submit-q');
    optionIds = testIds.optionIds(4, 'submit-opt');

    // Create a quiz session in progress
    const configResult = QuizConfig.create({
      examType: 'CCNA',
      questionCount: 3,
      timeLimit: 1800, // 30 minutes
    });
    if (!configResult.success) throw new Error('Test setup failed');

    const sessionResult = QuizSession.startNew(userId, configResult.data, questionIds, clock);
    if (!sessionResult.success) throw new Error('Test setup failed');

    quizSession = sessionResult.data;
    sessionId = quizSession.id; // Use actual session ID for tests

    // Default mock implementations
    mockQuizRepository.findById.mockResolvedValue(quizSession);
    mockQuizRepository.save.mockResolvedValue(undefined);

    const questionRef = new QuestionReference(questionIds[0], optionIds);
    mockQuestionService.getQuestionReference.mockResolvedValue(questionRef);
  });

  describe('successful answer submission', () => {
    it('should submit answer to first question successfully', async () => {
      // Arrange
      const request: SubmitAnswerRequest = {
        questionId: questionIds[0].toString(),
        selectedOptionIds: [optionIds[0].toString(), optionIds[1].toString()],
      };

      // Act
      const result = await submitAnswerHandler(
        request,
        sessionId,
        userId,
        mockQuizRepository,
        mockQuestionService,
        clock
      );

      // Assert
      expect(result.success).toBe(true);
      if (result.success) {
        const response = result.data as SubmitAnswerResponse;
        expect(response.sessionId).toBe(sessionId);
        expect(response.questionId).toBe(questionIds[0]);
        expect(response.selectedOptionIds).toEqual([optionIds[0], optionIds[1]]);
        expect(response.submittedAt).toEqual(clock.now());
        expect(response.state).toBe(QuizState.InProgress);
        expect(response.autoCompleted).toBe(false);
        expect(response.questionsAnswered).toBe(1);
        expect(response.totalQuestions).toBe(3);
      }

      // Verify repository interactions
      expect(mockQuizRepository.findById).toHaveBeenCalledWith(sessionId);
      expect(mockQuestionService.getQuestionReference).toHaveBeenCalledWith(questionIds[0]);
      expect(mockQuizRepository.save).toHaveBeenCalledTimes(1);
    });

    it('should auto-complete quiz when all questions answered with autoComplete enabled', async () => {
      // Arrange - Create quiz with auto-completion enabled
      const configResult = QuizConfig.create({
        examType: 'CCNA',
        questionCount: 1, // Only one question
        autoCompleteWhenAllAnswered: true,
      });
      if (!configResult.success) throw new Error('Test setup failed');

      const singleQuestionId = testIds.questionId('single-q');
      const sessionResult = QuizSession.startNew(
        userId,
        configResult.data,
        [singleQuestionId],
        clock
      );
      if (!sessionResult.success) throw new Error('Test setup failed');

      mockQuizRepository.findById.mockResolvedValue(sessionResult.data);

      const questionRef = new QuestionReference(singleQuestionId, optionIds);
      mockQuestionService.getQuestionReference.mockResolvedValue(questionRef);

      const request: SubmitAnswerRequest = {
        questionId: singleQuestionId.toString(),
        selectedOptionIds: [optionIds[0].toString()],
      };

      // Act
      const result = await submitAnswerHandler(
        request,
        sessionId,
        userId,
        mockQuizRepository,
        mockQuestionService,
        clock
      );

      // Assert
      expect(result.success).toBe(true);
      if (result.success) {
        const response = result.data as SubmitAnswerResponse;
        expect(response.state).toBe(QuizState.Completed);
        expect(response.autoCompleted).toBe(true);
        expect(response.questionsAnswered).toBe(1);
      }
    });
  });

  describe('validation errors', () => {
    it('should fail with invalid question ID', async () => {
      // Arrange
      const request = {
        questionId: '', // Invalid - empty
        selectedOptionIds: [optionIds[0].toString()],
      };

      // Act
      const result = await submitAnswerHandler(
        request,
        sessionId,
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

    it('should fail with no selected options', async () => {
      // Arrange
      const request = {
        questionId: questionIds[0].toString(),
        selectedOptionIds: [], // Invalid - empty array
      };

      // Act
      const result = await submitAnswerHandler(
        request,
        sessionId,
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

    it('should fail with duplicate option IDs', async () => {
      // Arrange
      const request = {
        questionId: questionIds[0].toString(),
        selectedOptionIds: [optionIds[0].toString(), optionIds[0].toString()], // Duplicate
      };

      // Act
      const result = await submitAnswerHandler(
        request,
        sessionId,
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
    it('should fail when quiz session not found', async () => {
      // Arrange
      mockQuizRepository.findById.mockResolvedValue(null);

      const request: SubmitAnswerRequest = {
        questionId: questionIds[0].toString(),
        selectedOptionIds: [optionIds[0].toString()],
      };

      // Act
      const result = await submitAnswerHandler(
        request,
        sessionId,
        userId,
        mockQuizRepository,
        mockQuestionService,
        clock
      );

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toContain('Quiz session not found');
      }
    });

    it('should fail when quiz session expired', async () => {
      // Arrange - Move clock forward to expire the quiz
      clock.advanceByMinutes(31); // Quiz has 30-minute time limit

      const request: SubmitAnswerRequest = {
        questionId: questionIds[0].toString(),
        selectedOptionIds: [optionIds[0].toString()],
      };

      // Act
      const result = await submitAnswerHandler(
        request,
        sessionId,
        userId,
        mockQuizRepository,
        mockQuestionService,
        clock
      );

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toContain('expired');
      }
    });

    it('should fail when question not found in quiz', async () => {
      // Arrange
      const wrongQuestionId = testIds.questionId('wrong-question');
      const request: SubmitAnswerRequest = {
        questionId: wrongQuestionId.toString(),
        selectedOptionIds: [optionIds[0].toString()],
      };

      // Act
      const result = await submitAnswerHandler(
        request,
        sessionId,
        userId,
        mockQuizRepository,
        mockQuestionService,
        clock
      );

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toContain('Question not found');
      }
    });

    it('should fail when question already answered', async () => {
      // Arrange - Submit first answer
      const questionRef = new QuestionReference(questionIds[0], optionIds);
      const submitResult = quizSession.submitAnswer(
        questionIds[0],
        [optionIds[0]],
        questionRef,
        clock
      );
      expect(submitResult.success).toBe(true);

      const request: SubmitAnswerRequest = {
        questionId: questionIds[0].toString(), // Same question again
        selectedOptionIds: [optionIds[1].toString()],
      };

      // Act
      const result = await submitAnswerHandler(
        request,
        sessionId,
        userId,
        mockQuizRepository,
        mockQuestionService,
        clock
      );

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toContain('already answered');
      }
    });

    it('should fail with invalid option IDs', async () => {
      // Arrange - Mock question reference with different valid options
      const differentOptions = testIds.optionIds(2, 'different-opt');
      const questionRef = new QuestionReference(questionIds[0], differentOptions);
      mockQuestionService.getQuestionReference.mockResolvedValue(questionRef);

      const request: SubmitAnswerRequest = {
        questionId: questionIds[0].toString(),
        selectedOptionIds: [optionIds[0].toString()], // Not in valid options
      };

      // Act
      const result = await submitAnswerHandler(
        request,
        sessionId,
        userId,
        mockQuizRepository,
        mockQuestionService,
        clock
      );

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toContain('Invalid options');
      }
    });
  });

  describe('service errors', () => {
    it('should handle question service failure', async () => {
      // Arrange
      mockQuestionService.getQuestionReference.mockRejectedValue(
        new Error('Question service unavailable')
      );

      const request: SubmitAnswerRequest = {
        questionId: questionIds[0].toString(),
        selectedOptionIds: [optionIds[0].toString()],
      };

      // Act
      const result = await submitAnswerHandler(
        request,
        sessionId,
        userId,
        mockQuizRepository,
        mockQuestionService,
        clock
      );

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toContain('Failed to load question');
      }
    });

    it('should handle repository save failure', async () => {
      // Arrange
      mockQuizRepository.save.mockRejectedValue(new Error('Database connection failed'));

      const request: SubmitAnswerRequest = {
        questionId: questionIds[0].toString(),
        selectedOptionIds: [optionIds[0].toString()],
      };

      // Act
      const result = await submitAnswerHandler(
        request,
        sessionId,
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
  });
});
