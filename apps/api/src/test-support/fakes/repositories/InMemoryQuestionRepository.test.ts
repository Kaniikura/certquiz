import { Question, QuestionStatus } from '@api/features/question/domain/entities/Question';
import { QuestionOption } from '@api/features/question/domain/value-objects/QuestionOption';
import { QuestionOptions } from '@api/features/question/domain/value-objects/QuestionOptions';
import {
  InvalidQuestionDataError,
  QuestionNotFoundError,
} from '@api/features/question/shared/errors';
import type { QuestionId } from '@api/features/quiz/domain/value-objects/Ids';
import type { Result } from '@api/shared/result';
import { beforeEach, describe, expect, it } from 'vitest';
import { InMemoryQuestionRepository } from './InMemoryQuestionRepository';

/**
 * Helper function to create a new Question with a specific status
 * while preserving all other properties from the base question
 */
function createQuestionWithStatus(
  baseQuestion: Question,
  status: QuestionStatus
): Result<Question> {
  return Question.fromJSON({
    ...baseQuestion.toJSON(),
    status,
    version: baseQuestion.version + 1,
    updatedAt: new Date().toISOString(),
  });
}

describe('InMemoryQuestionRepository - Moderation Tests', () => {
  let repository: InMemoryQuestionRepository;
  let testQuestion: Question;
  const testQuestionId = 'test-question-1' as QuestionId;
  const moderatedBy = '550e8400-e29b-41d4-a716-446655440001';

  beforeEach(() => {
    repository = new InMemoryQuestionRepository();

    // Create test question options
    const option1Result = QuestionOption.create({
      id: '550e8400-e29b-41d4-a716-446655440001',
      text: 'Option A',
      isCorrect: true,
    });
    const option2Result = QuestionOption.create({
      id: '550e8400-e29b-41d4-a716-446655440002',
      text: 'Option B',
      isCorrect: false,
    });

    if (!option1Result.success || !option2Result.success) {
      throw new Error('Failed to create test options');
    }

    const optionsResult = QuestionOptions.create([option1Result.data, option2Result.data]);
    if (!optionsResult.success) {
      throw new Error('Failed to create test options collection');
    }

    // Create test question
    const questionResult = Question.create({
      id: testQuestionId,
      version: 1,
      questionText: 'Test question for moderation',
      questionType: 'multiple_choice',
      explanation: 'Test explanation',
      detailedExplanation: 'Detailed test explanation',
      options: optionsResult.data,
      examTypes: ['CCNA'],
      categories: ['Networking'],
      difficulty: 'Beginner',
      tags: ['test', 'moderation'],
      images: [],
      isPremium: false,
      status: QuestionStatus.DRAFT,
      createdById: '550e8400-e29b-41d4-a716-446655440000',
      createdAt: new Date('2025-01-01T12:00:00Z'),
      updatedAt: new Date('2025-01-01T12:00:00Z'),
    });

    if (!questionResult.success) {
      throw new Error('Failed to create test question');
    }

    testQuestion = questionResult.data;
    repository.addQuestion(testQuestion);
  });

  describe('updateStatus - Moderation Logging', () => {
    it('should create moderation log when approving a question', async () => {
      const feedback = 'Question looks good, approved for use';

      await repository.updateStatus(testQuestionId, QuestionStatus.ACTIVE, moderatedBy, feedback);

      const logs = repository.getModerationLogs(testQuestionId);
      expect(logs).toHaveLength(1);
      expect(logs[0]).toEqual({
        questionId: testQuestionId,
        action: 'approve',
        moderatedBy,
        moderatedAt: expect.any(Date),
        feedback,
        previousStatus: QuestionStatus.DRAFT,
        newStatus: QuestionStatus.ACTIVE,
      });
    });

    it('should create moderation log when rejecting a question', async () => {
      const feedback = 'Question needs significant improvements before approval';

      await repository.updateStatus(testQuestionId, QuestionStatus.INACTIVE, moderatedBy, feedback);

      const logs = repository.getModerationLogs(testQuestionId);
      expect(logs).toHaveLength(1);
      expect(logs[0]).toEqual({
        questionId: testQuestionId,
        action: 'reject',
        moderatedBy,
        moderatedAt: expect.any(Date),
        feedback,
        previousStatus: QuestionStatus.DRAFT,
        newStatus: QuestionStatus.INACTIVE,
      });
    });

    it('should create moderation log when requesting changes', async () => {
      const feedback = 'Please clarify the explanation section';

      await repository.updateStatus(testQuestionId, QuestionStatus.DRAFT, moderatedBy, feedback);

      const logs = repository.getModerationLogs(testQuestionId);
      expect(logs).toHaveLength(1);
      expect(logs[0]).toEqual({
        questionId: testQuestionId,
        action: 'request_changes',
        moderatedBy,
        moderatedAt: expect.any(Date),
        feedback,
        previousStatus: QuestionStatus.DRAFT,
        newStatus: QuestionStatus.DRAFT,
      });
    });

    it('should create moderation log without feedback', async () => {
      await repository.updateStatus(testQuestionId, QuestionStatus.ACTIVE, moderatedBy);

      const logs = repository.getModerationLogs(testQuestionId);
      expect(logs).toHaveLength(1);
      expect(logs[0]).toEqual({
        questionId: testQuestionId,
        action: 'approve',
        moderatedBy,
        moderatedAt: expect.any(Date),
        feedback: undefined,
        previousStatus: QuestionStatus.DRAFT,
        newStatus: QuestionStatus.ACTIVE,
      });
    });

    it('should track multiple moderation actions for the same question', async () => {
      // First moderation action
      await repository.updateStatus(
        testQuestionId,
        QuestionStatus.ACTIVE,
        moderatedBy,
        'First approval'
      );

      // Reset to draft for second moderation (simulate re-submission)
      const updatedQuestion = await repository.findQuestionWithDetails(testQuestionId);
      if (updatedQuestion) {
        const draftResult = createQuestionWithStatus(updatedQuestion, QuestionStatus.DRAFT);

        if (draftResult.success) {
          repository.addQuestion(draftResult.data);
        }
      }

      // Second moderation action
      await repository.updateStatus(
        testQuestionId,
        QuestionStatus.INACTIVE,
        moderatedBy,
        'Second review - needs work'
      );

      const logs = repository.getModerationLogs(testQuestionId);
      expect(logs).toHaveLength(2);
      expect(logs[0].feedback).toBe('First approval');
      expect(logs[1].feedback).toBe('Second review - needs work');
    });

    it('should handle moderation logs for different questions independently', async () => {
      const secondQuestionId = 'test-question-2' as QuestionId;

      // Create second question
      const option1Result = QuestionOption.create({
        id: '550e8400-e29b-41d4-a716-446655440003',
        text: 'Option C',
        isCorrect: true,
      });
      const option2Result = QuestionOption.create({
        id: '550e8400-e29b-41d4-a716-446655440004',
        text: 'Option D',
        isCorrect: false,
      });

      if (!option1Result.success || !option2Result.success) {
        throw new Error('Failed to create test options');
      }

      const optionsResult = QuestionOptions.create([option1Result.data, option2Result.data]);
      if (!optionsResult.success) {
        throw new Error('Failed to create test options collection');
      }

      const secondQuestionResult = Question.create({
        id: secondQuestionId,
        version: 1,
        questionText: 'Second test question',
        questionType: 'multiple_choice',
        explanation: 'Second test explanation',
        detailedExplanation: undefined,
        options: optionsResult.data,
        examTypes: ['CCNP'],
        categories: ['Security'],
        difficulty: 'Intermediate',
        tags: ['test2'],
        images: [],
        isPremium: false,
        status: QuestionStatus.DRAFT,
        createdById: '550e8400-e29b-41d4-a716-446655440000',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      if (!secondQuestionResult.success) {
        throw new Error('Failed to create second test question');
      }

      repository.addQuestion(secondQuestionResult.data);

      // Moderate both questions
      await repository.updateStatus(
        testQuestionId,
        QuestionStatus.ACTIVE,
        moderatedBy,
        'First approved'
      );
      await repository.updateStatus(
        secondQuestionId,
        QuestionStatus.INACTIVE,
        moderatedBy,
        'Second rejected'
      );

      // Check logs are separate
      const firstLogs = repository.getModerationLogs(testQuestionId);
      const secondLogs = repository.getModerationLogs(secondQuestionId);

      expect(firstLogs).toHaveLength(1);
      expect(secondLogs).toHaveLength(1);
      expect(firstLogs[0].questionId).toBe(testQuestionId);
      expect(secondLogs[0].questionId).toBe(secondQuestionId);
      expect(firstLogs[0].action).toBe('approve');
      expect(secondLogs[0].action).toBe('reject');
    });
  });

  describe('Business Rule Validation', () => {
    it('should enforce that only DRAFT questions can be moderated', async () => {
      // First approve the question
      await repository.updateStatus(testQuestionId, QuestionStatus.ACTIVE, moderatedBy);

      // Try to moderate it again - should fail
      await expect(
        repository.updateStatus(
          testQuestionId,
          QuestionStatus.INACTIVE,
          moderatedBy,
          'Changed mind'
        )
      ).rejects.toThrow(InvalidQuestionDataError);
    });

    it('should require feedback for rejection with minimum length', async () => {
      // Test missing feedback
      await expect(
        repository.updateStatus(testQuestionId, QuestionStatus.ARCHIVED, moderatedBy)
      ).rejects.toThrow(InvalidQuestionDataError);

      // Test feedback too short
      await expect(
        repository.updateStatus(testQuestionId, QuestionStatus.ARCHIVED, moderatedBy, 'Too short')
      ).rejects.toThrow(InvalidQuestionDataError);

      // Test valid feedback
      await expect(
        repository.updateStatus(
          testQuestionId,
          QuestionStatus.ARCHIVED,
          moderatedBy,
          'This feedback is long enough to meet the requirements'
        )
      ).resolves.not.toThrow();
    });

    it('should handle question not found error', async () => {
      const nonExistentId = 'non-existent-question' as QuestionId;

      await expect(
        repository.updateStatus(nonExistentId, QuestionStatus.ACTIVE, moderatedBy)
      ).rejects.toThrow(QuestionNotFoundError);

      // Should not create any logs for non-existent question
      const logs = repository.getModerationLogs(nonExistentId);
      expect(logs).toHaveLength(0);
    });
  });

  describe('Status to Action Mapping', () => {
    it('should map QuestionStatus.ACTIVE to approve action', async () => {
      await repository.updateStatus(testQuestionId, QuestionStatus.ACTIVE, moderatedBy);

      const logs = repository.getModerationLogs(testQuestionId);
      expect(logs[0].action).toBe('approve');
    });

    it('should map QuestionStatus.INACTIVE to reject action', async () => {
      await repository.updateStatus(
        testQuestionId,
        QuestionStatus.INACTIVE,
        moderatedBy,
        'Needs improvement'
      );

      const logs = repository.getModerationLogs(testQuestionId);
      expect(logs[0].action).toBe('reject');
    });

    it('should map QuestionStatus.DRAFT to request_changes action', async () => {
      await repository.updateStatus(
        testQuestionId,
        QuestionStatus.DRAFT,
        moderatedBy,
        'Please clarify'
      );

      const logs = repository.getModerationLogs(testQuestionId);
      expect(logs[0].action).toBe('request_changes');
    });
  });

  describe('Test Helpers', () => {
    it('should provide getModerationLogs helper method', async () => {
      // Initially no logs
      expect(repository.getModerationLogs(testQuestionId)).toHaveLength(0);

      // After moderation, should have logs
      await repository.updateStatus(testQuestionId, QuestionStatus.ACTIVE, moderatedBy);
      expect(repository.getModerationLogs(testQuestionId)).toHaveLength(1);
    });

    it('should filter logs by question ID correctly', async () => {
      const otherQuestionId = 'other-question' as QuestionId;

      await repository.updateStatus(testQuestionId, QuestionStatus.ACTIVE, moderatedBy);

      // Should only return logs for the specific question
      const logs = repository.getModerationLogs(testQuestionId);
      const otherLogs = repository.getModerationLogs(otherQuestionId);

      expect(logs).toHaveLength(1);
      expect(otherLogs).toHaveLength(0);
    });
  });
});
