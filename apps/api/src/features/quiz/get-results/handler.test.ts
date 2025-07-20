/**
 * Get results handler tests
 * @fileoverview TDD tests for get results business logic
 */

import { TestClock, testIds } from '@api/test-support';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { QuizSession } from '../domain/aggregates/QuizSession';
import type { OptionId, QuestionId, QuizSessionId, UserId } from '../domain/value-objects/Ids';
import { QuestionReference } from '../domain/value-objects/QuestionReference';
import { QuizConfig } from '../domain/value-objects/QuizConfig';
import { QuizState } from '../domain/value-objects/QuizState';
import type { GetResultsRequest, GetResultsResponse } from './dto';
import { getResultsHandler } from './handler';
import type { QuestionDetails } from './QuestionDetailsService';

describe('getResultsHandler', () => {
  let mockQuizRepository: {
    findById: ReturnType<typeof vi.fn>;
    save: ReturnType<typeof vi.fn>;
    findExpiredSessions: ReturnType<typeof vi.fn>;
    findActiveByUser: ReturnType<typeof vi.fn>;
  };
  let mockQuestionDetailsService: {
    getQuestionDetails: ReturnType<typeof vi.fn>;
    getMultipleQuestionDetails: ReturnType<typeof vi.fn>;
  };
  let clock: TestClock;
  let userId: UserId;
  let sessionId: QuizSessionId;
  let questionIds: QuestionId[];
  let optionIds: OptionId[];
  let quizSession: QuizSession;
  let questionDetailsMap: Map<QuestionId, QuestionDetails>;

  beforeEach(async () => {
    // Setup mocks
    mockQuizRepository = {
      findById: vi.fn(),
      save: vi.fn(),
      findExpiredSessions: vi.fn(),
      findActiveByUser: vi.fn(),
    };

    mockQuestionDetailsService = {
      getQuestionDetails: vi.fn(),
      getMultipleQuestionDetails: vi.fn(),
    };

    // Setup test data
    clock = new TestClock(new Date('2025-01-20T10:00:00Z'));
    userId = testIds.userId();
    sessionId = testIds.quizSessionId();
    questionIds = testIds.questionIds(3, 'results-q');
    optionIds = testIds.optionIds(4, 'results-opt');

    // Create a completed quiz session with answers
    const configResult = QuizConfig.create({
      examType: 'CCNA',
      category: 'SWITCHING',
      questionCount: 3,
      timeLimit: 1800, // 30 minutes
      difficulty: 'INTERMEDIATE',
    });
    if (!configResult.success) throw new Error('Test setup failed');

    const sessionResult = QuizSession.startNew(userId, configResult.data, questionIds, clock);
    if (!sessionResult.success) throw new Error('Test setup failed');

    quizSession = sessionResult.data;
    sessionId = quizSession.id; // Use actual session ID

    // Submit answers to complete the quiz
    const questionRef1 = new QuestionReference(questionIds[0], optionIds);
    const questionRef2 = new QuestionReference(questionIds[1], optionIds);
    const questionRef3 = new QuestionReference(questionIds[2], optionIds);

    // Submit correct answer for first question (option 1 is correct in our mock)
    const answer1Result = quizSession.submitAnswer(
      questionIds[0],
      [optionIds[0]],
      questionRef1,
      clock
    );
    expect(answer1Result.success).toBe(true);

    // Submit incorrect answer for second question (option 2 is incorrect)
    clock.advanceByMinutes(1);
    const answer2Result = quizSession.submitAnswer(
      questionIds[1],
      [optionIds[1]],
      questionRef2,
      clock
    );
    expect(answer2Result.success).toBe(true);

    // Submit correct answer for third question
    clock.advanceByMinutes(1);
    const answer3Result = quizSession.submitAnswer(
      questionIds[2],
      [optionIds[0]],
      questionRef3,
      clock
    );
    expect(answer3Result.success).toBe(true);

    // Quiz should auto-complete after all answers submitted (autoCompleteWhenAllAnswered defaults to true)
    expect(quizSession.state).toBe(QuizState.Completed);

    // Setup question details mock data
    questionDetailsMap = new Map();
    questionIds.forEach((questionId, index) => {
      const details: QuestionDetails = {
        id: questionId,
        text: `Question ${index + 1}: Sample question text`,
        options: [
          {
            id: optionIds[0],
            text: 'Option A (Correct)',
            isCorrect: true,
          },
          {
            id: optionIds[1],
            text: 'Option B',
            isCorrect: false,
          },
          {
            id: optionIds[2],
            text: 'Option C',
            isCorrect: false,
          },
          {
            id: optionIds[3],
            text: 'Option D',
            isCorrect: false,
          },
        ],
        correctOptionIds: [optionIds[0]], // First option is always correct
      };
      questionDetailsMap.set(questionId, details);
    });

    // Default mock implementations
    mockQuizRepository.findById.mockResolvedValue(quizSession);
    mockQuestionDetailsService.getMultipleQuestionDetails.mockResolvedValue(questionDetailsMap);
  });

  describe('successful results retrieval', () => {
    it('should return complete results for completed quiz', async () => {
      // Arrange
      const request: GetResultsRequest = {};

      // Act
      const result = await getResultsHandler(
        request,
        sessionId,
        userId,
        mockQuizRepository,
        mockQuestionDetailsService
      );

      // Assert
      expect(result.success).toBe(true);
      if (result.success) {
        const response = result.data as GetResultsResponse;

        // Basic session info
        expect(response.sessionId).toBe(sessionId);
        expect(response.state).toBe(QuizState.Completed);
        expect(response.startedAt).toEqual(quizSession.startedAt);
        expect(response.completedAt).toEqual(quizSession.completedAt);
        expect(response.canViewResults).toBe(true);

        // Configuration
        expect(response.config.examType).toBe('CCNA');
        expect(response.config.category).toBe('SWITCHING');
        expect(response.config.questionCount).toBe(3);
        expect(response.config.timeLimit).toBe(1800);
        expect(response.config.difficulty).toBe('INTERMEDIATE');

        // Score summary (2 correct out of 3)
        expect(response.score.correctAnswers).toBe(2);
        expect(response.score.totalQuestions).toBe(3);
        expect(response.score.percentage).toBe(Math.round((2 / 3) * 100));
        expect(response.score.passed).toBeNull(); // No passing criteria defined
        expect(response.score.passingPercentage).toBeNull();

        // Individual answers
        expect(response.answers).toHaveLength(3);

        // First answer (correct)
        const answer1 = response.answers.find((a) => a.questionId === questionIds[0]);
        expect(answer1).toBeDefined();
        expect(answer1?.selectedOptionIds).toEqual([optionIds[0]]);
        expect(answer1?.correctOptionIds).toEqual([optionIds[0]]);
        expect(answer1?.isCorrect).toBe(true);
        expect(answer1?.questionText).toContain('Question 1');

        // Second answer (incorrect)
        const answer2 = response.answers.find((a) => a.questionId === questionIds[1]);
        expect(answer2).toBeDefined();
        expect(answer2?.selectedOptionIds).toEqual([optionIds[1]]);
        expect(answer2?.correctOptionIds).toEqual([optionIds[0]]);
        expect(answer2?.isCorrect).toBe(false);

        // Third answer (correct)
        const answer3 = response.answers.find((a) => a.questionId === questionIds[2]);
        expect(answer3).toBeDefined();
        expect(answer3?.selectedOptionIds).toEqual([optionIds[0]]);
        expect(answer3?.isCorrect).toBe(true);
      }

      // Verify service interactions
      expect(mockQuizRepository.findById).toHaveBeenCalledWith(sessionId);
      expect(mockQuestionDetailsService.getMultipleQuestionDetails).toHaveBeenCalledWith(
        questionIds
      );
    });

    it('should handle quiz without passing criteria', async () => {
      // Arrange
      const request: GetResultsRequest = {};

      // Act
      const result = await getResultsHandler(
        request,
        sessionId,
        userId,
        mockQuizRepository,
        mockQuestionDetailsService
      );

      // Assert
      expect(result.success).toBe(true);
      if (result.success) {
        const response = result.data as GetResultsResponse;
        // Since passing criteria is not implemented in domain model
        expect(response.score.passingPercentage).toBeNull();
        expect(response.score.passed).toBeNull();
      }
    });
  });

  describe('access control', () => {
    it('should fail when session not found', async () => {
      // Arrange
      mockQuizRepository.findById.mockResolvedValue(null);

      const request: GetResultsRequest = {};

      // Act
      const result = await getResultsHandler(
        request,
        sessionId,
        userId,
        mockQuizRepository,
        mockQuestionDetailsService
      );

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toContain('Quiz session not found');
      }
    });

    it('should fail when user does not own session', async () => {
      // Arrange
      const otherUserId = testIds.userId('other-user');

      const request: GetResultsRequest = {};

      // Act
      const result = await getResultsHandler(
        request,
        sessionId,
        otherUserId, // Different user
        mockQuizRepository,
        mockQuestionDetailsService
      );

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toContain('Unauthorized');
      }
    });

    it('should allow viewing results for in-progress quiz', async () => {
      // Arrange - Create quiz that's still in progress
      const inProgressConfigResult = QuizConfig.create({
        examType: 'CCNA',
        questionCount: 3,
      });
      if (!inProgressConfigResult.success) throw new Error('Test setup failed');

      const inProgressSessionResult = QuizSession.startNew(
        userId,
        inProgressConfigResult.data,
        questionIds,
        clock
      );
      if (!inProgressSessionResult.success) throw new Error('Test setup failed');

      const inProgressSession = inProgressSessionResult.data;
      mockQuizRepository.findById.mockResolvedValue(inProgressSession);

      const request: GetResultsRequest = {};

      // Act
      const result = await getResultsHandler(
        request,
        sessionId,
        userId,
        mockQuizRepository,
        mockQuestionDetailsService
      );

      // Assert
      expect(result.success).toBe(true);
      if (result.success) {
        const response = result.data as GetResultsResponse;
        expect(response.state).toBe(QuizState.InProgress);
        expect(response.canViewResults).toBe(true); // Allow viewing partial results
        expect(response.completedAt).toBeNull();
        expect(response.answers).toHaveLength(0); // No answers yet
      }
    });
  });

  describe('service errors', () => {
    it('should handle question details service failure', async () => {
      // Arrange
      mockQuestionDetailsService.getMultipleQuestionDetails.mockRejectedValue(
        new Error('Question service unavailable')
      );

      const request: GetResultsRequest = {};

      // Act
      const result = await getResultsHandler(
        request,
        sessionId,
        userId,
        mockQuizRepository,
        mockQuestionDetailsService
      );

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toContain('Failed to load question details');
      }
    });

    it('should handle repository failure', async () => {
      // Arrange
      mockQuizRepository.findById.mockRejectedValue(new Error('Database connection failed'));

      const request: GetResultsRequest = {};

      // Act
      const result = await getResultsHandler(
        request,
        sessionId,
        userId,
        mockQuizRepository,
        mockQuestionDetailsService
      );

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toContain('Failed to load quiz session');
      }
    });
  });
});
