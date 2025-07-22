/**
 * Create question request validation schema
 * @fileoverview Zod schema for admin question creation input validation with type inference
 */

import { z } from 'zod';
import { QuestionStatus } from '../domain/entities/Question';

/**
 * Available question types for creation
 */
const QuestionTypeSchema = z.enum(['multiple_choice', 'multiple_select', 'true_false']);

/**
 * Available question difficulties for creation
 */
const QuestionDifficultySchema = z.enum(['Beginner', 'Intermediate', 'Advanced', 'Mixed']);

/**
 * Available question statuses for creation
 * Uses the QuestionStatus enum values to ensure type compatibility
 */
const QuestionStatusSchema = z.nativeEnum(QuestionStatus);

/**
 * Question option schema with business rule validation
 * Enforces clear semantics for new vs existing options:
 * - New options: omit id field (system will generate UUID)
 * - Existing options: provide valid UUID id (references existing option)
 */
const QuestionOptionSchema = z
  .object({
    id: z.string().uuid('Invalid option ID format').optional(),
    text: z.string().min(1, 'Option text is required').max(500, 'Option text too long'),
    isCorrect: z.boolean(),
    // Optional marker to make intent explicit
    isNew: z.boolean().optional(),
  })
  .refine(
    (data) => {
      // Business rule: if isNew is explicitly set to true, id must not be provided
      if (data.isNew === true && data.id !== undefined) {
        return false;
      }
      return true;
    },
    {
      message: 'New options (isNew: true) should not include an id field',
      path: ['id'],
    }
  )
  .refine(
    (data) => {
      // Business rule: if isNew is explicitly set to false, id must be provided
      if (data.isNew === false && data.id === undefined) {
        return false;
      }
      return true;
    },
    {
      message: 'Existing options (isNew: false) must include a valid UUID id',
      path: ['id'],
    }
  );

/**
 * Create question request validation schema
 * Validates all required fields for question creation with business rules
 */
export const createQuestionSchema = z
  .object({
    questionText: z
      .string()
      .min(10, 'Question text must be at least 10 characters')
      .max(2000, 'Question text must not exceed 2000 characters'),

    questionType: QuestionTypeSchema,

    explanation: z
      .string()
      .min(10, 'Explanation must be at least 10 characters')
      .max(2000, 'Explanation must not exceed 2000 characters'),

    detailedExplanation: z
      .string()
      .max(5000, 'Detailed explanation must not exceed 5000 characters')
      .optional(),

    options: z
      .array(QuestionOptionSchema)
      .min(2, 'Question must have at least 2 options')
      .max(6, 'Question must not have more than 6 options'),

    examTypes: z
      .array(z.string().min(1, 'Exam type cannot be empty').max(50, 'Exam type too long'))
      .min(1, 'At least one exam type is required')
      .max(10, 'Too many exam types'),

    categories: z
      .array(z.string().min(1, 'Category cannot be empty').max(50, 'Category too long'))
      .min(1, 'At least one category is required')
      .max(10, 'Too many categories'),

    difficulty: QuestionDifficultySchema,

    tags: z
      .array(z.string().min(1, 'Tag cannot be empty').max(30, 'Tag too long'))
      .max(20, 'Too many tags')
      .default([]),

    images: z.array(z.string().url('Invalid image URL')).max(5, 'Too many images').default([]),

    isPremium: z.boolean().default(false),

    status: QuestionStatusSchema.default(QuestionStatus.DRAFT),
  })
  .refine(
    (data) => {
      // Validate that at least one option is correct
      return data.options.some((option) => option.isCorrect);
    },
    {
      message: 'At least one option must be correct',
      path: ['options'],
    }
  )
  .refine(
    (data) => {
      // For single answer questions, only one option can be correct
      if (data.questionType === 'multiple_choice' || data.questionType === 'true_false') {
        const correctCount = data.options.filter((option) => option.isCorrect).length;
        return correctCount === 1;
      }
      return true;
    },
    {
      message: 'Single answer questions must have exactly one correct option',
      path: ['options'],
    }
  )
  .refine(
    (data) => {
      // For multiple select questions, at least 2 options must be correct
      if (data.questionType === 'multiple_select') {
        const correctCount = data.options.filter((option) => option.isCorrect).length;
        return correctCount >= 2;
      }
      return true;
    },
    {
      message: 'Multiple select questions must have at least 2 correct options',
      path: ['options'],
    }
  )
  .refine(
    (data) => {
      // For true/false questions, must have exactly 2 options
      if (data.questionType === 'true_false') {
        return data.options.length === 2;
      }
      return true;
    },
    {
      message: 'True/False questions must have exactly 2 options',
      path: ['options'],
    }
  );

/**
 * Inferred type from validation schema
 * This ensures DTO and validation schema never drift apart
 */
export type CreateQuestionRequest = z.infer<typeof createQuestionSchema>;
