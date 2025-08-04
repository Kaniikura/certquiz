import type { QuestionId } from '@api/features/quiz/domain/value-objects/Ids';
import { describe, expect, it } from 'vitest';
import { QuestionOption } from '../value-objects/QuestionOption';
import { QuestionOptions } from '../value-objects/QuestionOptions';
import { Question, QuestionStatus } from './Question';

describe('Question', () => {
  const createValidOptions = () => {
    const opt1 = QuestionOption.create({
      id: '123e4567-e89b-12d3-a456-426614174001',
      text: 'Option 1',
      isCorrect: true,
    });
    const opt2 = QuestionOption.create({
      id: '123e4567-e89b-12d3-a456-426614174002',
      text: 'Option 2',
      isCorrect: false,
    });

    if (!opt1.success || !opt2.success) {
      throw new Error('Failed to create test options');
    }

    const options = QuestionOptions.create([opt1.data, opt2.data]);
    if (!options.success) {
      throw new Error('Failed to create test options collection');
    }

    return options.data;
  };

  describe('create', () => {
    it('should create a valid question', () => {
      const options = createValidOptions();

      const result = Question.create({
        id: '550e8400-e29b-41d4-a716-446655440000' as QuestionId,
        version: 1,
        questionText: 'What is 2 + 2?',
        questionType: 'multiple_choice',
        explanation: 'Basic arithmetic',
        detailedExplanation: 'Two plus two equals four',
        options,
        examTypes: ['CCNA'],
        categories: ['Math'],
        difficulty: 'Beginner',
        tags: ['arithmetic', 'basic'],
        images: [],
        isPremium: false,
        status: QuestionStatus.ACTIVE,
        createdById: '123e4567-e89b-12d3-a456-426614174000',
        createdAt: new Date('2025-01-01'),
        updatedAt: new Date('2025-01-01'),
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.id).toBe('550e8400-e29b-41d4-a716-446655440000');
        expect(result.data.questionText).toBe('What is 2 + 2?');
        expect(result.data.status).toBe('active');
        expect(result.data.isPremium).toBe(false);
      }
    });

    it('should fail with empty question text', () => {
      const options = createValidOptions();

      const result = Question.create({
        id: '550e8400-e29b-41d4-a716-446655440000' as QuestionId,
        version: 1,
        questionText: '',
        questionType: 'multiple_choice',
        explanation: 'Basic arithmetic',
        options,
        examTypes: ['CCNA'],
        categories: ['Math'],
        difficulty: 'Beginner',
        tags: [],
        images: [],
        isPremium: false,
        status: QuestionStatus.ACTIVE,
        createdById: '123e4567-e89b-12d3-a456-426614174000',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toContain('Question text cannot be empty');
      }
    });

    it('should fail with empty explanation', () => {
      const options = createValidOptions();

      const result = Question.create({
        id: '550e8400-e29b-41d4-a716-446655440000' as QuestionId,
        version: 1,
        questionText: 'What is 2 + 2?',
        questionType: 'multiple_choice',
        explanation: '',
        options,
        examTypes: ['CCNA'],
        categories: ['Math'],
        difficulty: 'Beginner',
        tags: [],
        images: [],
        isPremium: false,
        status: QuestionStatus.ACTIVE,
        createdById: '123e4567-e89b-12d3-a456-426614174000',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toContain('Explanation cannot be empty');
      }
    });

    it('should fail with no exam types', () => {
      const options = createValidOptions();

      const result = Question.create({
        id: '550e8400-e29b-41d4-a716-446655440000' as QuestionId,
        version: 1,
        questionText: 'What is 2 + 2?',
        questionType: 'multiple_choice',
        explanation: 'Basic arithmetic',
        options,
        examTypes: [],
        categories: ['Math'],
        difficulty: 'Beginner',
        tags: [],
        images: [],
        isPremium: false,
        status: QuestionStatus.ACTIVE,
        createdById: '123e4567-e89b-12d3-a456-426614174000',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toContain('At least one exam type is required');
      }
    });

    it('should fail with no categories', () => {
      const options = createValidOptions();

      const result = Question.create({
        id: '550e8400-e29b-41d4-a716-446655440000' as QuestionId,
        version: 1,
        questionText: 'What is 2 + 2?',
        questionType: 'multiple_choice',
        explanation: 'Basic arithmetic',
        options,
        examTypes: ['CCNA'],
        categories: [],
        difficulty: 'Beginner',
        tags: [],
        images: [],
        isPremium: false,
        status: QuestionStatus.ACTIVE,
        createdById: '123e4567-e89b-12d3-a456-426614174000',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toContain('At least one category is required');
      }
    });

    it('should fail with invalid version', () => {
      const options = createValidOptions();

      const result = Question.create({
        id: '550e8400-e29b-41d4-a716-446655440000' as QuestionId,
        version: 0,
        questionText: 'What is 2 + 2?',
        questionType: 'multiple_choice',
        explanation: 'Basic arithmetic',
        options,
        examTypes: ['CCNA'],
        categories: ['Math'],
        difficulty: 'Beginner',
        tags: [],
        images: [],
        isPremium: false,
        status: QuestionStatus.ACTIVE,
        createdById: '123e4567-e89b-12d3-a456-426614174000',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toContain('Version must be at least 1');
      }
    });
  });

  describe('methods', () => {
    const createTestQuestion = () => {
      const options = createValidOptions();
      const result = Question.create({
        id: '550e8400-e29b-41d4-a716-446655440000' as QuestionId,
        version: 1,
        questionText: 'What is 2 + 2?',
        questionType: 'multiple_choice',
        explanation: 'Basic arithmetic',
        options,
        examTypes: ['CCNA'],
        categories: ['Math'],
        difficulty: 'Beginner',
        tags: ['arithmetic'],
        images: [],
        isPremium: false,
        status: QuestionStatus.ACTIVE,
        createdById: '123e4567-e89b-12d3-a456-426614174000',
        createdAt: new Date('2025-01-01'),
        updatedAt: new Date('2025-01-01'),
      });

      if (!result.success) {
        throw new Error('Failed to create test question');
      }

      return result.data;
    };

    it('should update content', () => {
      const question = createTestQuestion();
      const newOptions = createValidOptions();

      const result = question.updateContent({
        questionText: 'What is 3 + 3?',
        explanation: 'Updated arithmetic',
        detailedExplanation: 'Three plus three equals six',
        options: newOptions,
      });

      expect(result.success).toBe(true);
      expect(question.questionText).toBe('What is 3 + 3?');
      expect(question.explanation).toBe('Updated arithmetic');
      expect(question.version).toBe(2); // Version should increment
    });

    it('should fail to update with empty text', () => {
      const question = createTestQuestion();
      const newOptions = createValidOptions();

      const result = question.updateContent({
        questionText: '',
        explanation: 'Updated arithmetic',
        options: newOptions,
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toContain('Question text cannot be empty');
      }
    });

    it('should update metadata', () => {
      const question = createTestQuestion();

      const result = question.updateMetadata({
        examTypes: ['CCNA', 'CCNP'],
        categories: ['Math', 'Networking'],
        difficulty: 'Intermediate',
        tags: ['arithmetic', 'advanced'],
      });

      expect(result.success).toBe(true);
      expect(question.examTypes).toEqual(['CCNA', 'CCNP']);
      expect(question.categories).toEqual(['Math', 'Networking']);
      expect(question.difficulty).toBe('Intermediate');
      expect(question.version).toBe(2); // Version should increment
    });

    it('should activate question', () => {
      const question = createTestQuestion();
      // First deactivate it
      question.deactivate();
      expect(question.status).toBe('inactive');

      // Then activate
      const result = question.activate();
      expect(result.success).toBe(true);
      expect(question.status).toBe('active');
    });

    it('should fail to activate already active question', () => {
      const question = createTestQuestion();

      const result = question.activate();
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toContain('already active');
      }
    });

    it('should deactivate question', () => {
      const question = createTestQuestion();

      const result = question.deactivate();
      expect(result.success).toBe(true);
      expect(question.status).toBe('inactive');
    });

    it('should set premium status', () => {
      const question = createTestQuestion();

      question.setPremium(true);
      expect(question.isPremium).toBe(true);

      question.setPremium(false);
      expect(question.isPremium).toBe(false);
    });

    it('should check if question type allows multiple answers', () => {
      const multipleSelect = createTestQuestion();
      expect(multipleSelect.allowsMultipleAnswers()).toBe(false);

      // Create a new question with multiple_select type
      const options = createValidOptions();
      const newQuestion = Question.create({
        id: '550e8400-e29b-41d4-a716-446655440001' as QuestionId,
        version: 1,
        questionText: 'What is 2 + 2?',
        questionType: 'multiple_select',
        explanation: 'Basic arithmetic',
        options,
        examTypes: ['CCNA'],
        categories: ['Math'],
        difficulty: 'Beginner',
        tags: ['arithmetic'],
        images: [],
        isPremium: false,
        status: QuestionStatus.ACTIVE,
        createdById: '123e4567-e89b-12d3-a456-426614174000',
        createdAt: new Date('2025-01-01'),
        updatedAt: new Date('2025-01-01'),
      });

      expect(newQuestion.success).toBe(true);
      if (newQuestion.success) {
        expect(newQuestion.data.allowsMultipleAnswers()).toBe(true);
      }
    });

    it('should get summary without answers', () => {
      const question = createTestQuestion();
      const summary = question.getSummary();

      expect(summary.questionId).toBe(question.id);
      expect(summary.questionText).toBe(question.questionText);
      expect(summary.hasImages).toBe(false);
      expect(summary.optionCount).toBe(2);
      expect(summary.isPremium).toBe(false);
      // Summary should not include the actual options
      expect('options' in summary).toBe(false);
    });
  });

  describe('toJSON and fromJSON', () => {
    it('should serialize and deserialize correctly', () => {
      const options = createValidOptions();
      const original = Question.create({
        id: '550e8400-e29b-41d4-a716-446655440000' as QuestionId,
        version: 1,
        questionText: 'What is 2 + 2?',
        questionType: 'multiple_choice',
        explanation: 'Basic arithmetic',
        detailedExplanation: 'Two plus two equals four',
        options,
        examTypes: ['CCNA'],
        categories: ['Math'],
        difficulty: 'Beginner',
        tags: ['arithmetic', 'basic'],
        images: ['image1.png'],
        isPremium: true,
        status: QuestionStatus.ACTIVE,
        createdById: '123e4567-e89b-12d3-a456-426614174000',
        createdAt: new Date('2025-01-01'),
        updatedAt: new Date('2025-01-01'),
      });

      expect(original.success).toBe(true);
      if (original.success) {
        const json = original.data.toJSON();
        const restored = Question.fromJSON(json);

        expect(restored.success).toBe(true);
        if (restored.success) {
          expect(restored.data.id).toBe(original.data.id);
          expect(restored.data.questionText).toBe(original.data.questionText);
          expect(restored.data.isPremium).toBe(original.data.isPremium);
          expect(restored.data.options.count).toBe(original.data.options.count);
        }
      }
    });
  });

  describe('moderateStatus - Business Rules', () => {
    const createTestQuestionWithStatus = (status: QuestionStatus = QuestionStatus.DRAFT) => {
      const options = createValidOptions();
      const result = Question.create({
        id: '550e8400-e29b-41d4-a716-446655440000' as QuestionId,
        version: 1,
        questionText: 'Test question for moderation?',
        questionType: 'multiple_choice',
        explanation: 'Test explanation',
        options,
        examTypes: ['CCNA'],
        categories: ['Networking'],
        difficulty: 'Intermediate',
        tags: ['test'],
        images: [],
        isPremium: false,
        status,
        createdById: 'test-user',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      if (!result.success) {
        throw new Error('Failed to create test question');
      }

      return result.data;
    };

    it('should allow moderation of DRAFT questions', () => {
      const question = createTestQuestionWithStatus(QuestionStatus.DRAFT);

      const result = question.moderateStatus(QuestionStatus.ACTIVE);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.action).toBe('approve');
        expect(result.data.previousStatus).toBe(QuestionStatus.DRAFT);
        expect(result.data.newStatus).toBe(QuestionStatus.ACTIVE);
      }
    });

    it('should prevent moderation of ACTIVE questions', () => {
      const question = createTestQuestionWithStatus(QuestionStatus.ACTIVE);

      const result = question.moderateStatus(QuestionStatus.ARCHIVED);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toContain('Only DRAFT questions can be moderated');
      }
    });

    it('should prevent moderation of ARCHIVED questions', () => {
      const question = createTestQuestionWithStatus(QuestionStatus.ARCHIVED);

      const result = question.moderateStatus(QuestionStatus.ACTIVE);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toContain('Only DRAFT questions can be moderated');
      }
    });

    it('should prevent moderation of INACTIVE questions', () => {
      const question = createTestQuestionWithStatus(QuestionStatus.INACTIVE);

      const result = question.moderateStatus(QuestionStatus.ACTIVE);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toContain('Only DRAFT questions can be moderated');
      }
    });

    it('should require feedback for rejection', () => {
      const question = createTestQuestionWithStatus(QuestionStatus.DRAFT);

      const result = question.moderateStatus(QuestionStatus.ARCHIVED);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toContain('Feedback is required for question rejection');
      }
    });

    it('should require minimum feedback length for rejection', () => {
      const question = createTestQuestionWithStatus(QuestionStatus.DRAFT);

      const result = question.moderateStatus(QuestionStatus.ARCHIVED, 'short');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toContain('must be at least 10 characters long');
      }
    });

    it('should successfully moderate with proper feedback', () => {
      const question = createTestQuestionWithStatus(QuestionStatus.DRAFT);

      const result = question.moderateStatus(
        QuestionStatus.ARCHIVED,
        'This question needs improvement because...'
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.action).toBe('reject');
      }
    });

    it('should update question status after successful moderation', () => {
      const question = createTestQuestionWithStatus(QuestionStatus.DRAFT);

      // Verify initial status
      expect(question.status).toBe(QuestionStatus.DRAFT);

      // Moderate the question
      const result = question.moderateStatus(QuestionStatus.ACTIVE);
      expect(result.success).toBe(true);

      // Verify status was updated
      expect(question.status).toBe(QuestionStatus.ACTIVE);

      // Try to moderate again - should fail
      const secondResult = question.moderateStatus(QuestionStatus.ARCHIVED, 'Changed my mind');
      expect(secondResult.success).toBe(false);
      if (!secondResult.success) {
        expect(secondResult.error.message).toContain('Only DRAFT questions can be moderated');
      }
    });
  });
});
