/**
 * QuizCompletionService Unit Tests
 * @fileoverview Comprehensive tests for atomic quiz completion with user progress updates
 */

import type { UserId } from '@api/features/auth/domain/value-objects/UserId';
import { AuthorizationError } from '@api/shared/errors';
import { QUIZ_REPO_TOKEN, USER_REPO_TOKEN } from '@api/shared/types/RepositoryToken';
import { testIds } from '@api/test-support/utils/id-generators';
import { TestClock } from '@api/test-support/utils/TestClock';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { IUnitOfWork } from '../../../infra/db/IUnitOfWork';
import type { IUnitOfWorkProvider } from '../../../infra/db/IUnitOfWorkProvider';
import { User } from '../../user/domain/entities/User';
import type { IUserRepository } from '../../user/domain/repositories/IUserRepository';
import { UserNotFoundError } from '../../user/shared/errors';
import { QuizSession } from '../domain/aggregates/QuizSession';
import type { IQuizRepository } from '../domain/repositories/IQuizRepository';
import type { QuestionId, QuizSessionId } from '../domain/value-objects/Ids';
import type { IQuestionDetailsService } from '../domain/value-objects/QuestionDetailsService';
import { QuestionReference } from '../domain/value-objects/QuestionReference';
import { QuizConfig } from '../domain/value-objects/QuizConfig';
import { QuizState } from '../domain/value-objects/QuizState';
import { SessionNotFoundError } from '../shared/errors';
import { QuizCompletionService } from './QuizCompletionService';

describe('QuizCompletionService', () => {
  let service: QuizCompletionService;
  let mockUnitOfWorkProvider: IUnitOfWorkProvider;
  let mockUnitOfWork: IUnitOfWork;
  let mockQuizRepo: IQuizRepository;
  let mockUserRepo: IUserRepository;
  let mockQuestionDetailsService: IQuestionDetailsService;
  let clock: TestClock;

  // Test data
  let userId: UserId;
  let sessionId: QuizSessionId;
  let session: QuizSession;
  let user: User;
  let questionIds: QuestionId[];

  beforeEach(async () => {
    // Setup test clock
    clock = new TestClock(new Date('2025-01-20T10:00:00Z'));

    // Setup test IDs
    userId = testIds.userId();
    sessionId = testIds.quizSessionId();
    questionIds = testIds.questionIds(3, 'test-q');

    // Setup mock repositories
    mockQuizRepo = {
      findById: vi.fn(),
      save: vi.fn(),
      findActiveByUser: vi.fn(),
      findExpiredSessions: vi.fn(),
      countTotalSessions: vi.fn(),
      countActiveSessions: vi.fn(),
      getAverageScore: vi.fn(),
      findAllForAdmin: vi.fn(),
      deleteWithCascade: vi.fn(),
    } as unknown as IQuizRepository;

    mockUserRepo = {
      findById: vi.fn(),
      save: vi.fn(),
      updateProgress: vi.fn(),
      findByEmail: vi.fn(),
      findByIdentityProviderId: vi.fn(),
      findByUsername: vi.fn(),
      create: vi.fn(),
      isEmailTaken: vi.fn(),
      isUsernameTaken: vi.fn(),
      update: vi.fn(),
    } as unknown as IUserRepository;

    // Setup mock question details service
    mockQuestionDetailsService = {
      getQuestionDetails: vi.fn(),
      getMultipleQuestionDetails: vi.fn().mockResolvedValue(
        new Map([
          [
            questionIds[0],
            {
              correctOptionIds: [testIds.optionId('opt1')],
              text: 'Question 1',
              options: [
                { id: testIds.optionId('opt1').toString(), text: 'Option 1', isCorrect: true },
                { id: testIds.optionId('opt2').toString(), text: 'Option 2', isCorrect: false },
              ],
            },
          ],
          [
            questionIds[1],
            {
              correctOptionIds: [testIds.optionId('opt2')],
              text: 'Question 2',
              options: [
                { id: testIds.optionId('opt1').toString(), text: 'Option 1', isCorrect: false },
                { id: testIds.optionId('opt2').toString(), text: 'Option 2', isCorrect: true },
              ],
            },
          ],
          [
            questionIds[2],
            {
              correctOptionIds: [testIds.optionId('opt3')],
              text: 'Question 3',
              options: [
                { id: testIds.optionId('opt1').toString(), text: 'Option 1', isCorrect: false },
                { id: testIds.optionId('opt3').toString(), text: 'Option 3', isCorrect: true },
              ],
            },
          ],
        ])
      ),
    };

    // Setup mock Unit of Work
    mockUnitOfWork = {
      begin: vi.fn().mockResolvedValue(undefined),
      commit: vi.fn().mockResolvedValue(undefined),
      rollback: vi.fn().mockResolvedValue(undefined),
      getRepository: vi.fn().mockImplementation((token) => {
        if (token === QUIZ_REPO_TOKEN) return mockQuizRepo;
        if (token === USER_REPO_TOKEN) return mockUserRepo;
        throw new Error(`Unknown token: ${token.toString()}`);
      }),
      getQuestionDetailsService: vi.fn().mockReturnValue(mockQuestionDetailsService),
    } as IUnitOfWork;

    mockUnitOfWorkProvider = {
      execute: vi.fn(async (operation) => {
        return operation(mockUnitOfWork);
      }),
    };

    // Create test quiz session in completed state
    const configResult = QuizConfig.create({
      examType: 'CCNA',
      questionCount: 3,
      timeLimit: 1800,
      autoCompleteWhenAllAnswered: true,
    });
    if (!configResult.success) throw new Error('Failed to create config');

    const sessionResult = QuizSession.startNew(userId, configResult.data, questionIds, clock);
    if (!sessionResult.success) throw new Error('Failed to create session');
    session = sessionResult.data;

    // Submit all answers to complete the quiz
    for (let i = 0; i < questionIds.length; i++) {
      const questionRef = new QuestionReference(questionIds[i], [testIds.optionId(`opt${i + 1}`)]);
      const submitResult = session.submitAnswer(
        questionIds[i],
        [testIds.optionId(`opt${i + 1}`)],
        questionRef,
        clock
      );
      if (!submitResult.success) throw new Error('Failed to submit answer');
    }

    // Verify session is completed
    expect(session.state).toBe(QuizState.Completed);

    // Create test user
    const authRow = {
      userId: userId.toString(),
      email: 'test@example.com',
      username: 'testuser',
      role: 'user',
      identityProviderId: null,
      isActive: true,
      createdAt: clock.now(),
      updatedAt: clock.now(),
    };

    const progressRow = {
      level: 1,
      experience: 0,
      totalQuestions: 0,
      correctAnswers: 0,
      accuracy: '0.00',
      studyTimeMinutes: 0,
      currentStreak: 0,
      lastStudyDate: null,
      categoryStats: { version: 1, categories: {} },
      updatedAt: clock.now(),
    };

    const userResult = User.fromPersistence(authRow, progressRow);
    if (!userResult.success) throw new Error('Failed to create user');
    user = userResult.data;

    // Create service instance
    service = new QuizCompletionService(mockUnitOfWorkProvider, clock);
  });

  describe('completeQuizWithProgressUpdate', () => {
    it('should successfully complete quiz and update user progress', async () => {
      // Arrange
      vi.mocked(mockQuizRepo.findById).mockResolvedValue(session);
      vi.mocked(mockUserRepo.findById).mockResolvedValue(user);
      vi.mocked(mockUserRepo.updateProgress).mockResolvedValue(undefined);
      vi.mocked(mockQuizRepo.save).mockResolvedValue(undefined);

      // Act
      const result = await service.completeQuizWithProgressUpdate(sessionId, userId);

      // Assert
      expect(result.success).toBe(true);
      if (!result.success) throw new Error('Expected success');

      const completionResult = result.data;
      expect(completionResult.sessionId).toBe(session.id);
      expect(completionResult.finalScore).toBe(100); // All answers correct
      expect(completionResult.progressUpdate).toEqual({
        previousLevel: 1,
        newLevel: 1, // May not level up with just one quiz
        experienceGained: expect.any(Number),
      });

      // Verify Unit of Work was used
      expect(mockUnitOfWorkProvider.execute).toHaveBeenCalledTimes(1);

      // Verify repositories were called within transaction
      expect(mockQuizRepo.findById).toHaveBeenCalledWith(sessionId);
      expect(mockUserRepo.findById).toHaveBeenCalledWith(userId);
      expect(mockQuizRepo.save).toHaveBeenCalledWith(session);
      expect(mockUserRepo.updateProgress).toHaveBeenCalled();

      // Verify question details were fetched
      expect(mockQuestionDetailsService.getMultipleQuestionDetails).toHaveBeenCalledWith(
        questionIds
      );
    });

    it('should fail when quiz session is not found', async () => {
      // Arrange
      vi.mocked(mockQuizRepo.findById).mockResolvedValue(null);

      // Act
      const result = await service.completeQuizWithProgressUpdate(sessionId, userId);

      // Assert
      expect(result.success).toBe(false);
      if (result.success) throw new Error('Expected failure');

      expect(result.error).toBeInstanceOf(SessionNotFoundError);
      expect(result.error.message).toContain(sessionId.toString());

      // Verify no further operations were attempted
      expect(mockUserRepo.findById).not.toHaveBeenCalled();
      expect(mockQuizRepo.save).not.toHaveBeenCalled();
      expect(mockUserRepo.updateProgress).not.toHaveBeenCalled();
    });

    it('should fail when session belongs to different user', async () => {
      // Arrange
      const differentUserId = testIds.userId('different-user');
      vi.mocked(mockQuizRepo.findById).mockResolvedValue(session);
      // Mock user repo to return null for the different user (in case auth check is bypassed)
      vi.mocked(mockUserRepo.findById).mockResolvedValue(null);

      // Act
      const result = await service.completeQuizWithProgressUpdate(session.id, differentUserId);

      // Assert
      expect(result.success).toBe(false);
      if (result.success) throw new Error('Expected failure');

      expect(result.error).toBeInstanceOf(AuthorizationError);
      expect(result.error.message).toBe('Session belongs to different user');

      // Verify no further operations were attempted
      expect(mockUserRepo.findById).not.toHaveBeenCalled();
      expect(mockQuizRepo.save).not.toHaveBeenCalled();
      expect(mockUserRepo.updateProgress).not.toHaveBeenCalled();
    });

    it('should fail when quiz is not in completed state', async () => {
      // Arrange
      // Create a session that's still in progress
      const inProgressConfigResult = QuizConfig.create({
        examType: 'CCNP_ENCOR',
        questionCount: 5,
        timeLimit: 3600,
      });
      if (!inProgressConfigResult.success) throw new Error('Failed to create config');

      const inProgressSessionResult = QuizSession.startNew(
        userId,
        inProgressConfigResult.data,
        testIds.questionIds(5, 'progress-q'),
        clock
      );
      if (!inProgressSessionResult.success) throw new Error('Failed to create session');
      const inProgressSession = inProgressSessionResult.data;

      vi.mocked(mockQuizRepo.findById).mockResolvedValue(inProgressSession);

      // Act
      const result = await service.completeQuizWithProgressUpdate(inProgressSession.id, userId);

      // Assert
      expect(result.success).toBe(false);
      if (result.success) throw new Error('Expected failure');

      expect(result.error.message).toContain(
        'must be in COMPLETED state but is currently IN_PROGRESS'
      );
      expect(result.error.message).toContain('Please ensure all questions are answered');

      // Verify no further operations were attempted
      expect(mockUserRepo.findById).not.toHaveBeenCalled();
      expect(mockQuizRepo.save).not.toHaveBeenCalled();
      expect(mockUserRepo.updateProgress).not.toHaveBeenCalled();
    });

    it('should fail when user is not found', async () => {
      // Arrange
      vi.mocked(mockQuizRepo.findById).mockResolvedValue(session);
      vi.mocked(mockUserRepo.findById).mockResolvedValue(null);

      // Act
      const result = await service.completeQuizWithProgressUpdate(sessionId, userId);

      // Assert
      expect(result.success).toBe(false);
      if (result.success) throw new Error('Expected failure');

      expect(result.error).toBeInstanceOf(UserNotFoundError);
      expect(result.error.message).toContain(userId.toString());

      // Verify no save operations were attempted
      expect(mockQuizRepo.save).not.toHaveBeenCalled();
      expect(mockUserRepo.updateProgress).not.toHaveBeenCalled();
    });

    it('should calculate partial score correctly', async () => {
      // Arrange
      // Create a session with some incorrect answers
      const partialSession = await createPartiallyCorrectSession();
      vi.mocked(mockQuizRepo.findById).mockResolvedValue(partialSession);
      vi.mocked(mockUserRepo.findById).mockResolvedValue(user);
      vi.mocked(mockUserRepo.updateProgress).mockResolvedValue(undefined);
      vi.mocked(mockQuizRepo.save).mockResolvedValue(undefined);

      // Act
      const result = await service.completeQuizWithProgressUpdate(partialSession.id, userId);

      // Assert
      expect(result.success).toBe(true);
      if (!result.success) throw new Error('Expected success');

      const completionResult = result.data;
      expect(completionResult.finalScore).toBe(67); // 2 out of 3 correct = 67%
      expect(completionResult.progressUpdate.experienceGained).toBeGreaterThan(0);
    });

    it('should handle Unit of Work transaction errors', async () => {
      // Arrange
      vi.mocked(mockQuizRepo.findById).mockResolvedValue(session);
      vi.mocked(mockUserRepo.findById).mockResolvedValue(user);
      vi.mocked(mockUserRepo.updateProgress).mockRejectedValue(new Error('Database error'));

      // Act
      const result = await service.completeQuizWithProgressUpdate(sessionId, userId);

      // Assert
      expect(result.success).toBe(false);
      if (result.success) throw new Error('Expected failure');

      expect(result.error.message).toBe('Database error');

      // Verify transaction was attempted
      expect(mockUnitOfWorkProvider.execute).toHaveBeenCalledTimes(1);
    });

    it('should handle unexpected errors gracefully', async () => {
      // Arrange
      mockUnitOfWorkProvider.execute = vi.fn().mockRejectedValue('Unexpected error string');

      // Act
      const result = await service.completeQuizWithProgressUpdate(sessionId, userId);

      // Assert
      expect(result.success).toBe(false);
      if (result.success) throw new Error('Expected failure');

      expect(result.error).toBeInstanceOf(Error);
      expect(result.error.message).toBe('Unknown error occurred during quiz completion');
    });
  });

  // Helper function to create a partially correct session
  async function createPartiallyCorrectSession(): Promise<QuizSession> {
    const configResult = QuizConfig.create({
      examType: 'CCNA',
      questionCount: 3,
      timeLimit: 1800,
      autoCompleteWhenAllAnswered: true,
    });
    if (!configResult.success) throw new Error('Failed to create config');

    const sessionResult = QuizSession.startNew(userId, configResult.data, questionIds, clock);
    if (!sessionResult.success) throw new Error('Failed to create session');
    const partialSession = sessionResult.data;

    // Submit answers: 2 correct, 1 incorrect
    const submitResult1 = partialSession.submitAnswer(
      questionIds[0],
      [testIds.optionId('opt1')], // Correct
      new QuestionReference(questionIds[0], [testIds.optionId('opt1'), testIds.optionId('opt2')]),
      clock
    );
    if (!submitResult1.success) throw new Error('Failed to submit answer 1');

    const submitResult2 = partialSession.submitAnswer(
      questionIds[1],
      [testIds.optionId('opt1')], // Incorrect (opt2 is correct)
      new QuestionReference(questionIds[1], [testIds.optionId('opt1'), testIds.optionId('opt2')]),
      clock
    );
    if (!submitResult2.success) throw new Error('Failed to submit answer 2');

    const submitResult3 = partialSession.submitAnswer(
      questionIds[2],
      [testIds.optionId('opt3')], // Correct
      new QuestionReference(questionIds[2], [testIds.optionId('opt1'), testIds.optionId('opt3')]),
      clock
    );
    if (!submitResult3.success) throw new Error('Failed to submit answer 3');

    expect(partialSession.state).toBe(QuizState.Completed);
    return partialSession;
  }
});
