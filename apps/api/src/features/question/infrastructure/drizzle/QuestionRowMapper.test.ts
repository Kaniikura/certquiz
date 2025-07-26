import { describe, expect, it } from 'vitest';
import { type Question, QuestionStatus } from '../../domain/entities/Question';
import {
  mapQuestionStatusToDb,
  mapQuestionTypeToDb,
  mapRowToQuestion,
  mapToQuestionSummary,
} from './QuestionRowMapper';
import type { QuestionRow, QuestionVersionRow } from './schema/question';

describe('QuestionRowMapper', () => {
  const validQuestionRow: QuestionRow = {
    questionId: '123e4567-e89b-12d3-a456-426614174000',
    currentVersion: 2,
    createdById: '456e7890-e89b-12d3-a456-426614174000',
    isUserGenerated: false,
    isPremium: false,
    status: 'active',
    createdAt: new Date('2024-01-01T00:00:00Z'),
    updatedAt: new Date('2024-01-15T00:00:00Z'),
  };

  const validVersionRow: QuestionVersionRow = {
    questionId: '123e4567-e89b-12d3-a456-426614174000',
    version: 2,
    questionText: 'What is the purpose of a VLAN?',
    questionType: 'single',
    explanation: 'VLANs segment networks at Layer 2',
    detailedExplanation: 'Virtual LANs (VLANs) are used to create logical network segments...',
    images: ['https://example.com/vlan.png'],
    tags: ['networking', 'vlan', 'switching'],
    options: [
      {
        id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        text: 'To segment networks at Layer 2',
        isCorrect: true,
      },
      {
        id: 'b2c3d4e5-f6a7-8901-bcde-f12345678901',
        text: 'To route between networks',
        isCorrect: false,
      },
      {
        id: 'c3d4e5f6-a7b8-9012-cdef-123456789012',
        text: 'To provide DHCP services',
        isCorrect: false,
      },
      {
        id: 'd4e5f6a7-b8c9-0123-defa-234567890123',
        text: 'To encrypt network traffic',
        isCorrect: false,
      },
    ],
    examTypes: ['CCNA', 'Network+'],
    categories: ['Switching', 'Network Segmentation'],
    difficulty: 'Intermediate',
    createdAt: new Date('2024-01-15T00:00:00Z'),
  };

  describe('mapQuestionTypeToDb', () => {
    it('should map multiple_choice to single', () => {
      expect(mapQuestionTypeToDb('multiple_choice')).toBe('single');
    });

    it('should map true_false to single', () => {
      expect(mapQuestionTypeToDb('true_false')).toBe('single');
    });

    it('should map multiple_select to multiple', () => {
      expect(mapQuestionTypeToDb('multiple_select')).toBe('multiple');
    });
  });

  describe('mapQuestionStatusToDb', () => {
    it('should map active status', () => {
      expect(mapQuestionStatusToDb(QuestionStatus.ACTIVE)).toBe('active');
    });

    it('should map inactive status', () => {
      expect(mapQuestionStatusToDb(QuestionStatus.INACTIVE)).toBe('inactive');
    });

    it('should map archived status', () => {
      expect(mapQuestionStatusToDb(QuestionStatus.ARCHIVED)).toBe('archived');
    });
  });

  describe('mapRowToQuestion', () => {
    it('should map valid rows to Question entity', () => {
      const result = mapRowToQuestion(validQuestionRow, validVersionRow);

      expect(result.success).toBe(true);
      const question = (result as { success: true; data: Question }).data;
      expect(question.id).toBe(validQuestionRow.questionId);
      expect(question.version).toBe(validQuestionRow.currentVersion);
      expect(question.questionText).toBe(validVersionRow.questionText);
      expect(question.questionType).toBe('multiple_choice');
      expect(question.explanation).toBe(validVersionRow.explanation);
      expect(question.detailedExplanation).toBe(validVersionRow.detailedExplanation);
      expect(question.isPremium).toBe(validQuestionRow.isPremium);
      expect(question.status).toBe('active');
      expect(question.options.getAll()).toHaveLength(4);
      expect(question.examTypes).toEqual(validVersionRow.examTypes);
      expect(question.categories).toEqual(validVersionRow.categories);
      expect(question.difficulty).toBe(validVersionRow.difficulty);
    });

    it('should handle null detailedExplanation', () => {
      const versionWithNullDetail = {
        ...validVersionRow,
        detailedExplanation: null,
      };

      const result = mapRowToQuestion(validQuestionRow, versionWithNullDetail);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.detailedExplanation).toBeUndefined();
      }
    });

    it('should handle empty images array', () => {
      const versionWithNoImages = {
        ...validVersionRow,
        images: [],
      };

      const result = mapRowToQuestion(validQuestionRow, versionWithNoImages);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.images).toEqual([]);
      }
    });

    it('should fail with mismatched questionId', () => {
      const mismatchedVersion = {
        ...validVersionRow,
        questionId: 'different-id',
      };

      const result = mapRowToQuestion(validQuestionRow, mismatchedVersion);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toContain('Question ID mismatch');
      }
    });

    it('should fail with mismatched version', () => {
      const mismatchedVersion = {
        ...validVersionRow,
        version: 1, // currentVersion is 2
      };

      const result = mapRowToQuestion(validQuestionRow, mismatchedVersion);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toContain('Version mismatch');
      }
    });

    it('should fail with invalid options structure', () => {
      const invalidOptionsVersion = {
        ...validVersionRow,
        options: 'not-an-array' as never,
      };

      const result = mapRowToQuestion(validQuestionRow, invalidOptionsVersion);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toContain('Invalid options');
      }
    });

    it('should fail with no correct answer', () => {
      const noCorrectAnswerVersion = {
        ...validVersionRow,
        options: [
          { id: 'e5f6a7b8-c9d0-1234-efab-345678901234', text: 'Option 1', isCorrect: false },
          { id: 'f6a7b8c9-d0e1-2345-fabc-456789012345', text: 'Option 2', isCorrect: false },
        ],
      };

      const result = mapRowToQuestion(validQuestionRow, noCorrectAnswerVersion);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toContain('correct answer');
      }
    });

    it('should handle multiple question type with multiple correct answers', () => {
      const multipleChoiceVersion = {
        ...validVersionRow,
        questionType: 'multiple' as const,
        options: [
          { id: 'a7b8c9d0-e1f2-3456-abcd-567890123456', text: 'Option 1', isCorrect: true },
          { id: 'b8c9d0e1-f2a3-4567-bcde-678901234567', text: 'Option 2', isCorrect: true },
          { id: 'c9d0e1f2-a3b4-5678-cdef-789012345678', text: 'Option 3', isCorrect: false },
          { id: 'd0e1f2a3-b4c5-6789-defa-890123456789', text: 'Option 4', isCorrect: false },
        ],
      };

      const result = mapRowToQuestion(validQuestionRow, multipleChoiceVersion);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.questionType).toBe('multiple_select');
        const correctOptions = result.data.options.getAll().filter((opt) => opt.isCorrect);
        expect(correctOptions).toHaveLength(2);
      }
    });
  });

  describe('mapToQuestionSummary', () => {
    it('should map to question summary', () => {
      const summary = mapToQuestionSummary(validQuestionRow, validVersionRow);

      expect(summary.questionId.toString()).toBe(validQuestionRow.questionId);
      expect(summary.questionText).toBe(validVersionRow.questionText);
      expect(summary.questionType).toBe('multiple_choice');
      expect(summary.examTypes).toEqual(validVersionRow.examTypes);
      expect(summary.categories).toEqual(validVersionRow.categories);
      expect(summary.difficulty).toBe(validVersionRow.difficulty);
      expect(summary.isPremium).toBe(validQuestionRow.isPremium);
      expect(summary.tags).toEqual(validVersionRow.tags);
      expect(summary.hasImages).toBe(true);
      expect(summary.optionCount).toBe(4);
    });

    it('should handle missing detailed explanation', () => {
      const versionWithNoDetail = {
        ...validVersionRow,
        detailedExplanation: null,
      };

      const summary = mapToQuestionSummary(validQuestionRow, versionWithNoDetail);

      expect(summary.hasImages).toBe(true); // Has images from validVersionRow
    });

    it('should set hasImages correctly when multiple images are present', () => {
      const versionWithMultipleImages = {
        ...validVersionRow,
        images: ['img1.png', 'img2.png', 'img3.png'],
      };

      const summary = mapToQuestionSummary(validQuestionRow, versionWithMultipleImages);

      expect(summary.hasImages).toBe(true);
      expect(summary.optionCount).toBe(4);
    });
  });
});
