/**
 * DrizzleQuestionRepository tests
 * @fileoverview Unit and integration tests for Question repository implementation
 */

import type { QuestionId } from '@api/features/quiz/domain';
import { authUser, userProgress } from '@api/infra/db/schema/user';
import type { Queryable } from '@api/infra/db/types';
import { TestClock } from '@api/test-support';
import { withRollback } from '@api/testing/infra/db';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  QuestionNotFoundError,
  QuestionRepositoryError,
  QuestionVersionConflictError,
} from '../../shared/errors';
import { Question, QuestionStatus } from '../entities/Question';
import { QuestionOption } from '../value-objects/QuestionOption';
import { QuestionOptions } from '../value-objects/QuestionOptions';
import { DrizzleQuestionRepository } from './DrizzleQuestionRepository';

// Import the TransactionalConnection interface
interface TransactionalConnection extends Queryable {
  transaction<T>(fn: (tx: import('@api/infra/db/types').Tx) => Promise<T>): Promise<T>;
}

// Type alias for test compatibility - uses TransactionalConnection to match repository constraints
// We know the test database has all the necessary tables and transaction support
type TestQueryable = TransactionalConnection;

describe('DrizzleQuestionRepository', () => {
  const clock = new TestClock(new Date('2025-01-01T00:00:00Z'));
  const mockLogger = {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Helper to create test user
  async function createTestUser(db: TestQueryable, testUserId = crypto.randomUUID()) {
    await db.insert(authUser).values({
      userId: testUserId,
      email: 'test@example.com',
      username: 'testuser',
      role: 'user',
      isActive: true,
    });

    await db.insert(userProgress).values({
      userId: testUserId,
      level: 1,
      experience: 0,
      totalQuestions: 0,
      correctAnswers: 0,
      accuracy: '0.00',
      studyTimeMinutes: 0,
      currentStreak: 0,
      categoryStats: { version: 1 },
    });

    return testUserId;
  }

  // Helper to create test question
  function createTestQuestion(
    testUserId: string,
    overrides?: Partial<Parameters<typeof Question.create>[0]>
  ) {
    const option1Result = QuestionOption.create({
      id: crypto.randomUUID(),
      text: 'Option 1',
      isCorrect: true,
    });
    const option2Result = QuestionOption.create({
      id: crypto.randomUUID(),
      text: 'Option 2',
      isCorrect: false,
    });

    if (!option1Result.success || !option2Result.success) {
      throw new Error('Failed to create test options');
    }

    const optionsResult = QuestionOptions.create([option1Result.data, option2Result.data]);
    if (!optionsResult.success) {
      throw new Error('Failed to create test options collection');
    }

    const questionResult = Question.create({
      id: crypto.randomUUID() as QuestionId,
      version: 1,
      questionText: 'What is the capital of France?',
      questionType: 'multiple_choice',
      explanation: 'Paris is the capital of France',
      options: optionsResult.data,
      examTypes: ['GENERAL'],
      categories: ['Geography'],
      difficulty: 'Beginner',
      tags: ['europe', 'capitals'],
      images: [],
      isPremium: false,
      status: QuestionStatus.ACTIVE,
      createdById: testUserId,
      createdAt: clock.now(),
      updatedAt: clock.now(),
      ...overrides,
    });

    if (!questionResult.success) {
      throw new Error(`Failed to create test question: ${questionResult.error.message}`);
    }

    return questionResult.data;
  }

  describe('createQuestion', () => {
    it('should create a new question with version 1', async () => {
      await withRollback(async (trx) => {
        // Arrange
        const testUserId = await createTestUser(trx as unknown as TestQueryable);
        const repo = new DrizzleQuestionRepository(trx as unknown as TestQueryable, mockLogger);
        const question = createTestQuestion(testUserId);

        // Act
        const created = await repo.createQuestion(question);

        // Assert
        expect(created.id).toBe(question.id);
        expect(created.version).toBe(1);
        expect(created.questionText).toBe(question.questionText);
        expect(created.status).toBe(QuestionStatus.ACTIVE);
        expect(mockLogger.info).toHaveBeenCalledWith('Question created successfully', {
          questionId: question.id,
          version: 1,
        });
      });
    });

    it('should handle database errors during creation', async () => {
      await withRollback(async (trx) => {
        // Arrange
        const repo = new DrizzleQuestionRepository(trx as unknown as TestQueryable, mockLogger);
        const question = createTestQuestion('invalid-uuid');

        // Act & Assert
        await expect(repo.createQuestion(question)).rejects.toThrow(QuestionRepositoryError);
        expect(mockLogger.error).toHaveBeenCalled();
      });
    });
  });

  describe('updateQuestion', () => {
    it('should update existing question and increment version', async () => {
      await withRollback(async (trx) => {
        // Arrange
        const testUserId = await createTestUser(trx as unknown as TestQueryable);
        const repo = new DrizzleQuestionRepository(trx as unknown as TestQueryable, mockLogger);
        const question = createTestQuestion(testUserId);
        await repo.createQuestion(question);

        // Update the question
        const updateResult = question.updateContent({
          questionText: 'Updated question text',
          explanation: 'Updated explanation',
          options: question.options,
        });
        if (!updateResult.success) throw updateResult.error;

        // Act
        const updated = await repo.updateQuestion(question);

        // Assert
        expect(updated.version).toBe(2);
        expect(updated.questionText).toBe('Updated question text');
        expect(updated.explanation).toBe('Updated explanation');
        expect(mockLogger.info).toHaveBeenCalledWith('Question updated successfully', {
          questionId: question.id,
          version: 2,
        });
      });
    });

    it('should throw version conflict error when versions mismatch', async () => {
      await withRollback(async (trx) => {
        // Arrange
        const testUserId = await createTestUser(trx as unknown as TestQueryable);
        const repo = new DrizzleQuestionRepository(trx as unknown as TestQueryable, mockLogger);
        const question = createTestQuestion(testUserId);
        await repo.createQuestion(question);

        // Another process updates the question
        const anotherRepo = new DrizzleQuestionRepository(
          trx as unknown as TestQueryable,
          mockLogger
        );
        const sameQuestion = await repo.findQuestionWithDetails(question.id);
        if (!sameQuestion) throw new Error('Question not found');

        const updateResult = sameQuestion.updateContent({
          questionText: 'Concurrent update',
          explanation: sameQuestion.explanation,
          options: sameQuestion.options,
        });
        if (!updateResult.success) throw updateResult.error;

        await anotherRepo.updateQuestion(sameQuestion);

        // Try to update with outdated version
        const outdatedUpdateResult = question.updateContent({
          questionText: 'This should fail',
          explanation: question.explanation,
          options: question.options,
        });
        if (!outdatedUpdateResult.success) throw outdatedUpdateResult.error;

        // Act & Assert
        await expect(repo.updateQuestion(question)).rejects.toThrow(QuestionVersionConflictError);
        expect(mockLogger.warn).toHaveBeenCalledWith(
          'Version conflict detected',
          expect.objectContaining({
            questionId: question.id,
            expectedVersion: 1,
            actualVersion: 2,
          })
        );
      });
    });

    it('should throw not found error when question does not exist', async () => {
      await withRollback(async (trx) => {
        // Arrange
        const repo = new DrizzleQuestionRepository(trx as unknown as TestQueryable, mockLogger);
        const question = createTestQuestion(crypto.randomUUID());

        // Act & Assert
        await expect(repo.updateQuestion(question)).rejects.toThrow(QuestionNotFoundError);
      });
    });
  });

  describe('findQuestionWithDetails', () => {
    it('should find question with full details', async () => {
      await withRollback(async (trx) => {
        // Arrange
        const testUserId = await createTestUser(trx as unknown as TestQueryable);
        const repo = new DrizzleQuestionRepository(trx as unknown as TestQueryable, mockLogger);
        const question = createTestQuestion(testUserId);
        await repo.createQuestion(question);

        // Act
        const found = await repo.findQuestionWithDetails(question.id);

        // Assert
        expect(found).not.toBeNull();
        expect(found?.id).toBe(question.id);
        expect(found?.questionText).toBe(question.questionText);
        expect(found?.options.count).toBe(2);
        expect(found?.options.getCorrectOptions()).toHaveLength(1);
        expect(mockLogger.debug).toHaveBeenCalledWith('Finding question with details', {
          questionId: question.id,
        });
      });
    });

    it('should return null when question not found', async () => {
      await withRollback(async (trx) => {
        // Arrange
        const repo = new DrizzleQuestionRepository(trx as unknown as TestQueryable, mockLogger);
        const nonExistentId = crypto.randomUUID() as QuestionId;

        // Act
        const found = await repo.findQuestionWithDetails(nonExistentId);

        // Assert
        expect(found).toBeNull();
        expect(mockLogger.debug).toHaveBeenCalledWith('Question not found', {
          questionId: nonExistentId,
        });
      });
    });

    it('should correctly identify and map true/false questions', async () => {
      await withRollback(async (trx) => {
        // Arrange
        const testUserId = await createTestUser(trx as unknown as TestQueryable);
        const repo = new DrizzleQuestionRepository(trx as unknown as TestQueryable, mockLogger);

        // Create a true/false question
        const trueOption = QuestionOption.create({
          id: crypto.randomUUID(),
          text: 'True',
          isCorrect: true,
        });
        const falseOption = QuestionOption.create({
          id: crypto.randomUUID(),
          text: 'False',
          isCorrect: false,
        });

        if (!trueOption.success || !falseOption.success) {
          throw new Error('Failed to create true/false options');
        }

        const optionsResult = QuestionOptions.create([trueOption.data, falseOption.data]);
        if (!optionsResult.success) {
          throw new Error('Failed to create options collection');
        }

        const trueFalseQuestion = createTestQuestion(testUserId, {
          questionText: 'Is the sky blue?',
          questionType: 'true_false',
          options: optionsResult.data,
          explanation: 'The sky appears blue due to light scattering',
        });

        // Act
        await repo.createQuestion(trueFalseQuestion);
        const found = await repo.findQuestionWithDetails(trueFalseQuestion.id);

        // Assert
        expect(found).not.toBeNull();
        expect(found?.questionType).toBe('true_false');
        expect(found?.questionText).toBe('Is the sky blue?');
        expect(found?.options.count).toBe(2);
      });
    });

    it('should correctly map multiple choice questions with more than 2 options', async () => {
      await withRollback(async (trx) => {
        // Arrange
        const testUserId = await createTestUser(trx as unknown as TestQueryable);
        const repo = new DrizzleQuestionRepository(trx as unknown as TestQueryable, mockLogger);

        // Create a multiple choice question with 4 options
        const options = [];
        for (let i = 0; i < 4; i++) {
          const optionResult = QuestionOption.create({
            id: crypto.randomUUID(),
            text: `Option ${i + 1}`,
            isCorrect: i === 0,
          });
          if (!optionResult.success) throw new Error('Failed to create option');
          options.push(optionResult.data);
        }

        const optionsResult = QuestionOptions.create(options);
        if (!optionsResult.success) throw new Error('Failed to create options collection');

        const multipleChoiceQuestion = createTestQuestion(testUserId, {
          questionText: 'Which is the correct answer?',
          questionType: 'multiple_choice',
          options: optionsResult.data,
        });

        // Act
        await repo.createQuestion(multipleChoiceQuestion);
        const found = await repo.findQuestionWithDetails(multipleChoiceQuestion.id);

        // Assert
        expect(found).not.toBeNull();
        expect(found?.questionType).toBe('multiple_choice');
        expect(found?.options.count).toBe(4);
      });
    });
  });

  describe('findQuestionById', () => {
    it('should find question summary excluding answers', async () => {
      await withRollback(async (trx) => {
        // Arrange
        const testUserId = await createTestUser(trx as unknown as TestQueryable);
        const repo = new DrizzleQuestionRepository(trx as unknown as TestQueryable, mockLogger);
        const question = createTestQuestion(testUserId, { isPremium: false });
        await repo.createQuestion(question);

        // Act
        const summary = await repo.findQuestionById(question.id, false);

        // Assert
        expect(summary).not.toBeNull();
        expect(summary?.questionId).toBe(question.id);
        expect(summary?.questionText).toBe(question.questionText);
        expect(summary?.optionCount).toBe(2);
        expect(summary?.isPremium).toBe(false);
        // Should not include answer details
        expect(summary).not.toHaveProperty('options');
        expect(summary).not.toHaveProperty('explanation');
      });
    });

    it('should exclude premium questions when includePremium is false', async () => {
      await withRollback(async (trx) => {
        // Arrange
        const testUserId = await createTestUser(trx as unknown as TestQueryable);
        const repo = new DrizzleQuestionRepository(trx as unknown as TestQueryable, mockLogger);
        const premiumQuestion = createTestQuestion(testUserId, { isPremium: true });
        await repo.createQuestion(premiumQuestion);

        // Act
        const summary = await repo.findQuestionById(premiumQuestion.id, false);

        // Assert
        expect(summary).toBeNull();
      });
    });

    it('should include premium questions when includePremium is true', async () => {
      await withRollback(async (trx) => {
        // Arrange
        const testUserId = await createTestUser(trx as unknown as TestQueryable);
        const repo = new DrizzleQuestionRepository(trx as unknown as TestQueryable, mockLogger);
        const premiumQuestion = createTestQuestion(testUserId, { isPremium: true });
        await repo.createQuestion(premiumQuestion);

        // Act
        const summary = await repo.findQuestionById(premiumQuestion.id, true);

        // Assert
        expect(summary).not.toBeNull();
        expect(summary?.isPremium).toBe(true);
      });
    });
  });

  describe('findQuestions', () => {
    it('should find questions with pagination', async () => {
      await withRollback(async (trx) => {
        // Arrange
        const testUserId = await createTestUser(trx as unknown as TestQueryable);
        const repo = new DrizzleQuestionRepository(trx as unknown as TestQueryable, mockLogger);

        // Create multiple questions
        for (let i = 0; i < 5; i++) {
          const question = createTestQuestion(testUserId, {
            questionText: `Question ${i + 1}`,
            examTypes: ['CCNA'],
            categories: ['Networking'],
          });
          await repo.createQuestion(question);
        }

        // Act
        const result = await repo.findQuestions({ activeOnly: true }, { limit: 3, offset: 0 });

        // Assert
        expect(result.questions).toHaveLength(3);
        expect(result.pagination.total).toBe(5);
        expect(result.pagination.hasNext).toBe(true);
        expect(result.pagination.limit).toBe(3);
        expect(result.pagination.offset).toBe(0);
      });
    });

    it('should filter by exam types', async () => {
      await withRollback(async (trx) => {
        // Arrange
        const testUserId = await createTestUser(trx as unknown as TestQueryable);
        const repo = new DrizzleQuestionRepository(trx as unknown as TestQueryable, mockLogger);

        await repo.createQuestion(createTestQuestion(testUserId, { examTypes: ['CCNA'] }));
        await repo.createQuestion(createTestQuestion(testUserId, { examTypes: ['CCNP'] }));
        await repo.createQuestion(createTestQuestion(testUserId, { examTypes: ['CCNA', 'CCNP'] }));

        // Act
        const result = await repo.findQuestions({ examTypes: ['CCNA'] }, { limit: 10, offset: 0 });

        // Assert
        expect(result.questions).toHaveLength(2);
        expect(result.questions.every((q) => q.examTypes.includes('CCNA'))).toBe(true);
      });
    });

    it('should filter by difficulty', async () => {
      await withRollback(async (trx) => {
        // Arrange
        const testUserId = await createTestUser(trx as unknown as TestQueryable);
        const repo = new DrizzleQuestionRepository(trx as unknown as TestQueryable, mockLogger);

        await repo.createQuestion(createTestQuestion(testUserId, { difficulty: 'Beginner' }));
        await repo.createQuestion(createTestQuestion(testUserId, { difficulty: 'Intermediate' }));
        await repo.createQuestion(createTestQuestion(testUserId, { difficulty: 'Advanced' }));

        // Act
        const result = await repo.findQuestions(
          { difficulty: 'Intermediate' },
          { limit: 10, offset: 0 }
        );

        // Assert
        expect(result.questions).toHaveLength(1);
        expect(result.questions[0].difficulty).toBe('Intermediate');
      });
    });

    it('should handle search query', async () => {
      await withRollback(async (trx) => {
        // Arrange
        const testUserId = await createTestUser(trx as unknown as TestQueryable);
        const repo = new DrizzleQuestionRepository(trx as unknown as TestQueryable, mockLogger);

        await repo.createQuestion(
          createTestQuestion(testUserId, { questionText: 'What is TCP/IP?' })
        );
        await repo.createQuestion(
          createTestQuestion(testUserId, { questionText: 'Explain OSI model' })
        );

        // Act
        const result = await repo.findQuestions({ searchQuery: 'TCP' }, { limit: 10, offset: 0 });

        // Assert
        expect(result.questions).toHaveLength(1);
        expect(result.questions[0].questionText).toContain('TCP');
      });
    });

    // Validation is now handled by listQuestionsSchema at the handler level
    // Repository trusts that incoming data is already validated
  });

  describe('getQuestionStats', () => {
    it('should return aggregated statistics', async () => {
      await withRollback(async (trx) => {
        // Arrange
        const testUserId = await createTestUser(trx as unknown as TestQueryable);
        const repo = new DrizzleQuestionRepository(trx as unknown as TestQueryable, mockLogger);

        // Create test data
        await repo.createQuestion(
          createTestQuestion(testUserId, {
            examTypes: ['CCNA'],
            difficulty: 'Beginner',
            isPremium: false,
          })
        );
        await repo.createQuestion(
          createTestQuestion(testUserId, {
            examTypes: ['CCNA'],
            difficulty: 'Intermediate',
            isPremium: true,
          })
        );
        await repo.createQuestion(
          createTestQuestion(testUserId, {
            examTypes: ['CCNP'],
            difficulty: 'Advanced',
            isPremium: true,
          })
        );

        // Act
        const stats = await repo.getQuestionStats();

        // Assert
        expect(stats.totalQuestions).toBe(3);
        expect(stats.questionsByExamType.CCNA).toBe(2);
        expect(stats.questionsByExamType.CCNP).toBe(1);
        expect(stats.questionsByDifficulty.Beginner).toBe(1);
        expect(stats.questionsByDifficulty.Intermediate).toBe(1);
        expect(stats.questionsByDifficulty.Advanced).toBe(1);
        expect(stats.premiumQuestions).toBe(2);
      });
    });

    it('should handle empty database', async () => {
      await withRollback(async (trx) => {
        // Arrange
        const repo = new DrizzleQuestionRepository(trx as unknown as TestQueryable, mockLogger);

        // Act
        const stats = await repo.getQuestionStats();

        // Assert
        expect(stats.totalQuestions).toBe(0);
        expect(stats.questionsByExamType).toEqual({});
        expect(stats.questionsByDifficulty).toEqual({});
        expect(stats.premiumQuestions).toBe(0);
      });
    });
  });
});
