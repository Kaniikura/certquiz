/**
 * Update progress request validation schema
 * @fileoverview Zod schema for progress update input validation with type inference
 */

import { z } from 'zod';

/**
 * Update progress request validation schema
 * Validates quiz completion data for progress updates
 */
export const updateProgressSchema = z
  .object({
    userId: z.string().min(1, 'User ID is required').uuid('Invalid user ID format'),
    correctAnswers: z
      .number()
      .int('Correct answers must be an integer')
      .min(0, 'Correct answers cannot be negative'),
    totalQuestions: z
      .number()
      .int('Total questions must be an integer')
      .min(1, 'Total questions must be at least 1'),
    category: z.string().min(1, 'Category is required').max(50, 'Category name too long'),
    studyTimeMinutes: z
      .number()
      .int('Study time must be an integer')
      .min(0, 'Study time cannot be negative')
      .max(1440, 'Study time cannot exceed 24 hours'), // 24 * 60 = 1440 minutes
  })
  .refine((data) => data.correctAnswers <= data.totalQuestions, {
    message: 'Correct answers cannot exceed total questions',
    path: ['correctAnswers'],
  });

/**
 * Inferred type from validation schema
 * This ensures DTO and validation schema never drift apart
 */
export type UpdateProgressRequest = z.infer<typeof updateProgressSchema>;
