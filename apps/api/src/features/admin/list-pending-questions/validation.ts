/**
 * List Pending Questions Validation
 * @fileoverview Zod schemas for pending questions listing validation
 */

import { z } from 'zod';

/**
 * Status enum for validation
 */
const StatusSchema = z.enum(['DRAFT', 'ACTIVE', 'INACTIVE', 'ARCHIVED'], {
  errorMap: () => ({ message: 'Status must be DRAFT, ACTIVE, INACTIVE, or ARCHIVED' }),
});

/**
 * Difficulty validation schema
 */
const DifficultySchema = z.enum(['Beginner', 'Intermediate', 'Advanced', 'Expert', 'Mixed'], {
  errorMap: () => ({ message: 'Invalid difficulty level' }),
});

/**
 * Order by field validation
 */
const OrderBySchema = z.enum(['createdAt', 'updatedAt'], {
  errorMap: () => ({ message: 'Order by must be createdAt or updatedAt' }),
});

/**
 * Order direction validation
 */
const OrderDirSchema = z.enum(['asc', 'desc'], {
  errorMap: () => ({ message: 'Order direction must be asc or desc' }),
});

/**
 * Page validation schema
 */
const PageSchema = z.number().int().min(1, {
  message: 'Page must be greater than 0',
});

/**
 * Page size validation schema
 */
const PageSizeSchema = z
  .number()
  .int()
  .min(1, {
    message: 'Page size must be between 1 and 100',
  })
  .max(100, {
    message: 'Page size must be between 1 and 100',
  });

/**
 * Date validation schema
 */
const DateSchema = z.date();

/**
 * Exam type validation schema
 */
const ExamTypeSchema = z
  .string()
  .min(1, {
    message: 'Exam type cannot be empty',
  })
  .max(50, {
    message: 'Exam type must not exceed 50 characters',
  });

/**
 * Validation schema for list pending questions parameters
 */
export const ListPendingQuestionsParamsSchema = z
  .object({
    page: PageSchema,
    pageSize: PageSizeSchema,
    status: StatusSchema.optional(),
    dateFrom: DateSchema.optional(),
    dateTo: DateSchema.optional(),
    examType: ExamTypeSchema.optional(),
    difficulty: DifficultySchema.optional(),
    orderBy: OrderBySchema.optional(),
    orderDir: OrderDirSchema.optional(),
  })
  .refine(
    (data) => {
      // Business rule: dateFrom must be before or equal to dateTo
      if (data.dateFrom && data.dateTo && data.dateFrom > data.dateTo) {
        return false;
      }
      return true;
    },
    {
      message: 'dateFrom must be before or equal to dateTo',
      path: ['dateFrom'],
    }
  );
