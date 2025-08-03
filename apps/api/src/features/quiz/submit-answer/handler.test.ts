/**
 * Submit answer handler tests
 * @fileoverview TDD tests for submit answer business logic
 */

import type { UserId } from '@api/features/auth/domain/value-objects/UserId';
import { ValidationError } from '@api/shared/errors';
import { testIds } from '@api/test-support/utils/id-generators';
import { TestClock } from '@api/test-support/utils/TestClock';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { QuizSession } from '../domain/aggregates/QuizSession';
import { type OptionId, QuestionId, type QuizSessionId } from '../domain/value-objects/Ids';
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
    countTotalSessions: ReturnType<typeof vi.fn>;
    countActiveSessions: ReturnType<typeof vi.fn>;
    getAverageScore: ReturnType<typeof vi.fn>;
  };
  let mockQuestionService: {
    getQuestionReference: ReturnType<typeof vi.fn>;
  };
  let mockQuizCompletionService: {
    completeQuizWithProgressUpdate: ReturnType<typeof vi.fn>;
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
      countTotalSessions: vi.fn().mockResolvedValue(0),
      countActiveSessions: vi.fn().mockResolvedValue(0),
      getAverageScore: vi.fn().mockResolvedValue(0),
    };

    mockQuestionService = {
      getQuestionReference: vi.fn(),
    };

    mockQuizCompletionService = {
      completeQuizWithProgressUpdate: vi.fn(),
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
        mockQuizCompletionService,
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

      // Mock quiz completion service for auto-completion
      mockQuizCompletionService.completeQuizWithProgressUpdate.mockResolvedValue({
        success: true,
        data: {
          sessionId: sessionResult.data.id,
          finalScore: 100,
          progressUpdate: {
            previousLevel: 1,
            newLevel: 1,
            experienceGained: 50,
          },
        },
      });

      const request: SubmitAnswerRequest = {
        questionId: singleQuestionId.toString(),
        selectedOptionIds: [optionIds[0].toString()],
      };

      // Act
      const result = await submitAnswerHandler(
        request,
        sessionResult.data.id,
        userId,
        mockQuizRepository,
        mockQuestionService,
        mockQuizCompletionService,
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
        mockQuizCompletionService,
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
        mockQuizCompletionService,
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
        mockQuizCompletionService,
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
        mockQuizCompletionService,
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
        mockQuizCompletionService,
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
        mockQuizCompletionService,
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
        mockQuizCompletionService,
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
        mockQuizCompletionService,
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
        mockQuizCompletionService,
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
        mockQuizCompletionService,
        clock
      );

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toContain('Failed to save');
      }
    });
  });

  describe('non-sequential answering', () => {
    it('should calculate correct question index when answering out of order', async () => {
      // Arrange - Create session with 5 questions and non-sequential answering allowed
      const fiveQuestionIds = [
        testIds.questionId('q1'),
        testIds.questionId('q2'),
        testIds.questionId('q3'),
        testIds.questionId('q4'),
        testIds.questionId('q5'),
      ];

      const nonSeqConfig = QuizConfig.create({
        examType: 'CCNA',
        questionCount: 5,
        enforceSequentialAnswering: false, // Allow out-of-order
      });

      if (!nonSeqConfig.success) throw new Error('Test setup failed');

      const nonSeqSessionResult = QuizSession.startNew(
        userId,
        nonSeqConfig.data,
        fiveQuestionIds,
        clock
      );

      if (!nonSeqSessionResult.success) throw new Error('Test setup failed');
      const nonSeqSession = nonSeqSessionResult.data;

      mockQuizRepository.findById.mockResolvedValue(nonSeqSession);
      mockQuizRepository.save.mockResolvedValue(undefined);

      // Setup mock question references for all questions
      const q1Ref = new QuestionReference(fiveQuestionIds[0], testIds.optionIds(3, 'q1-opt'));
      const q2Ref = new QuestionReference(fiveQuestionIds[1], testIds.optionIds(3, 'q2-opt'));
      const q3Ref = new QuestionReference(fiveQuestionIds[2], testIds.optionIds(3, 'q3-opt'));
      const q4Ref = new QuestionReference(fiveQuestionIds[3], testIds.optionIds(3, 'q4-opt'));
      const q5Ref = new QuestionReference(fiveQuestionIds[4], testIds.optionIds(3, 'q5-opt'));

      // Mock to return correct reference based on question ID
      const questionRefs = new Map([
        [fiveQuestionIds[0].toString(), q1Ref],
        [fiveQuestionIds[1].toString(), q2Ref],
        [fiveQuestionIds[2].toString(), q3Ref],
        [fiveQuestionIds[3].toString(), q4Ref],
        [fiveQuestionIds[4].toString(), q5Ref],
      ]);

      mockQuestionService.getQuestionReference.mockImplementation(async (qId) => {
        const ref = questionRefs.get(QuestionId.toString(qId));
        if (!ref) {
          throw new Error(`Unexpected question ID: ${QuestionId.toString(qId)}`);
        }
        return ref;
      });

      // Act - Answer question 3 (index 2) first
      const request1 = {
        questionId: fiveQuestionIds[2].toString(),
        selectedOptionIds: [testIds.optionId('q3-opt1').toString()],
      };

      const result1 = await submitAnswerHandler(
        request1,
        nonSeqSession.id,
        userId,
        mockQuizRepository,
        mockQuestionService,
        mockQuizCompletionService,
        clock
      );

      // Assert
      expect(result1.success).toBe(true);
      if (result1.success) {
        expect(result1.data.currentQuestionIndex).toBe(2); // q3 is at index 2
        expect(result1.data.questionsAnswered).toBe(1);
      }

      // Update mock to return the session with first answer
      const savedSession1 = mockQuizRepository.save.mock.calls[0][0];
      mockQuizRepository.findById.mockResolvedValue(savedSession1);

      // Act - Answer question 1 (index 0)
      const request2 = {
        questionId: fiveQuestionIds[0].toString(),
        selectedOptionIds: [testIds.optionId('q1-opt1').toString()],
      };

      const result2 = await submitAnswerHandler(
        request2,
        nonSeqSession.id,
        userId,
        mockQuizRepository,
        mockQuestionService,
        mockQuizCompletionService,
        clock
      );

      // Assert
      expect(result2.success).toBe(true);
      if (result2.success) {
        expect(result2.data.currentQuestionIndex).toBe(0); // q1 is at index 0
        expect(result2.data.questionsAnswered).toBe(2);
      }
    });
  });

  describe('auto-completion with progress updates', () => {
    it('should return progress update when quiz is auto-completed', async () => {
      // Arrange
      const autoCompleteConfig = QuizConfig.create({
        examType: 'CCNA',
        questionCount: 2,
        timeLimit: 600,
        autoCompleteWhenAllAnswered: true,
      });
      if (!autoCompleteConfig.success) throw new Error('Config failed');

      const autoCompleteSession = QuizSession.startNew(
        userId,
        autoCompleteConfig.data,
        [questionIds[0], questionIds[1]],
        clock
      );
      if (!autoCompleteSession.success) throw new Error('Session failed');
      const session = autoCompleteSession.data;

      // Submit first answer
      const firstAnswerResult = session.submitAnswer(
        questionIds[0],
        [optionIds[0]],
        new QuestionReference(questionIds[0], optionIds),
        clock
      );
      if (!firstAnswerResult.success) throw new Error('First answer failed');

      // Mock the quiz completion service to return progress update
      mockQuizCompletionService.completeQuizWithProgressUpdate.mockResolvedValue({
        success: true,
        data: {
          sessionId: session.id,
          finalScore: 85,
          progressUpdate: {
            previousLevel: 1,
            newLevel: 2,
            experienceGained: 150,
          },
        },
      });

      mockQuizRepository.findById.mockResolvedValue(session);
      mockQuizRepository.save.mockResolvedValue(undefined);

      // Mock question reference for second question
      const questionRef = new QuestionReference(questionIds[1], optionIds);
      mockQuestionService.getQuestionReference.mockResolvedValue(questionRef);

      // Submit final answer
      const request: SubmitAnswerRequest = {
        questionId: questionIds[1].toString(),
        selectedOptionIds: [optionIds[1].toString()],
      };

      // Act
      const result = await submitAnswerHandler(
        request,
        session.id,
        userId,
        mockQuizRepository,
        mockQuestionService,
        mockQuizCompletionService,
        clock
      );

      // Assert
      expect(result.success).toBe(true);
      if (result.success) {
        const response = result.data as SubmitAnswerResponse;
        expect(response.autoCompleted).toBe(true);
        expect(response.state).toBe(QuizState.Completed);
        expect(response.progressUpdate).toBeDefined();
        expect(response.progressUpdate).toEqual({
          finalScore: 85,
          previousLevel: 1,
          newLevel: 2,
          experienceGained: 150,
        });
      }

      // Verify completion service was called
      expect(mockQuizCompletionService.completeQuizWithProgressUpdate).toHaveBeenCalledWith(
        session.id,
        userId
      );
    });

    it('should handle quiz completion service failures gracefully', async () => {
      // Arrange
      const autoCompleteConfig = QuizConfig.create({
        examType: 'CCNA',
        questionCount: 2,
        timeLimit: 600,
        autoCompleteWhenAllAnswered: true,
      });
      if (!autoCompleteConfig.success) throw new Error('Config failed');

      const autoCompleteSession = QuizSession.startNew(
        userId,
        autoCompleteConfig.data,
        [questionIds[0], questionIds[1]],
        clock
      );
      if (!autoCompleteSession.success) throw new Error('Session failed');
      const session = autoCompleteSession.data;

      // Submit first answer
      const firstAnswerResult = session.submitAnswer(
        questionIds[0],
        [optionIds[0]],
        new QuestionReference(questionIds[0], optionIds),
        clock
      );
      if (!firstAnswerResult.success) throw new Error('First answer failed');

      // Mock the quiz completion service to fail
      mockQuizCompletionService.completeQuizWithProgressUpdate.mockResolvedValue({
        success: false,
        error: new Error('Progress update failed'),
      });

      mockQuizRepository.findById.mockResolvedValue(session);
      mockQuizRepository.save.mockResolvedValue(undefined);

      // Mock question reference for second question
      const questionRef = new QuestionReference(questionIds[1], optionIds);
      mockQuestionService.getQuestionReference.mockResolvedValue(questionRef);

      // Submit final answer
      const request: SubmitAnswerRequest = {
        questionId: questionIds[1].toString(),
        selectedOptionIds: [optionIds[1].toString()],
      };

      // Act
      const result = await submitAnswerHandler(
        request,
        session.id,
        userId,
        mockQuizRepository,
        mockQuestionService,
        mockQuizCompletionService,
        clock
      );

      // Assert - submission should still succeed even if progress update fails
      expect(result.success).toBe(true);
      if (result.success) {
        const response = result.data as SubmitAnswerResponse;
        expect(response.autoCompleted).toBe(true);
        expect(response.state).toBe(QuizState.Completed);
        expect(response.progressUpdate).toBeUndefined(); // No progress update due to failure
      }

      // Verify completion service was called
      expect(mockQuizCompletionService.completeQuizWithProgressUpdate).toHaveBeenCalledWith(
        session.id,
        userId
      );
    });

    it('should not call completion service when quiz is not auto-completed', async () => {
      // Arrange - quiz without auto-completion
      const noAutoCompleteConfig = QuizConfig.create({
        examType: 'CCNA',
        questionCount: 3,
        timeLimit: 1800,
        autoCompleteWhenAllAnswered: false, // Auto-completion disabled
      });
      if (!noAutoCompleteConfig.success) throw new Error('Config failed');

      const noAutoCompleteSession = QuizSession.startNew(
        userId,
        noAutoCompleteConfig.data,
        questionIds,
        clock
      );
      if (!noAutoCompleteSession.success) throw new Error('Session failed');
      const session = noAutoCompleteSession.data;

      mockQuizRepository.findById.mockResolvedValue(session);
      mockQuizRepository.save.mockResolvedValue(undefined);

      const request: SubmitAnswerRequest = {
        questionId: questionIds[0].toString(),
        selectedOptionIds: [optionIds[0].toString()],
      };

      // Act
      const result = await submitAnswerHandler(
        request,
        session.id,
        userId,
        mockQuizRepository,
        mockQuestionService,
        mockQuizCompletionService,
        clock
      );

      // Assert
      expect(result.success).toBe(true);
      if (result.success) {
        const response = result.data as SubmitAnswerResponse;
        expect(response.autoCompleted).toBe(false);
        expect(response.progressUpdate).toBeUndefined();
      }

      // Verify completion service was NOT called
      expect(mockQuizCompletionService.completeQuizWithProgressUpdate).not.toHaveBeenCalled();
    });
  });
});
