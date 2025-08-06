/**
 * Delete quiz validation schema
 * @fileoverview Zod schema for admin quiz deletion parameters
 */

import { z } from 'zod';

/**
 * Validation schema for delete quiz parameters
 */
export const deleteQuizSchema = z.object({
  quizId: z.string().uuid('Invalid quiz ID format'),
  deletedBy: z.string().uuid('Invalid admin user ID format'),
  reason: z
    .string()
    .min(10, 'Deletion reason is required and must be at least 10 characters')
    .max(500, 'Deletion reason must not exceed 500 characters'),
});
