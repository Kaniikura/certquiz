/**
 * List quizzes validation schema
 * @fileoverview Zod schema for admin quiz listing query parameters
 */

import { z } from 'zod';

/**
 * Validation schema for list quizzes query parameters
 */
export const listQuizzesSchema = z
  .object({
    page: z.number().int().min(1, 'Page must be greater than 0'),
    pageSize: z
      .number()
      .int()
      .min(1, 'Page size must be between 1 and 100')
      .max(100, 'Page size must be between 1 and 100'),
    state: z.enum(['IN_PROGRESS', 'COMPLETED', 'EXPIRED']).optional(),
    userId: z.string().uuid('Invalid user ID format').optional(),
    dateFrom: z.date().optional(),
    dateTo: z.date().optional(),
  })
  .refine(
    (data) => {
      if (data.dateFrom && data.dateTo) {
        return data.dateFrom <= data.dateTo;
      }
      return true;
    },
    {
      message: 'dateFrom must be before or equal to dateTo',
      path: ['dateFrom'],
    }
  );
