/**
 * List questions request validation schema
 * @fileoverview Zod schema for question listing input validation with type inference
 */

import { z } from 'zod';

/**
 * Available question difficulties for filtering
 */
const QuestionDifficultySchema = z.enum(['Beginner', 'Intermediate', 'Advanced', 'Mixed']);

/**
 * Flexible boolean parser for query parameters
 * Accepts common boolean representations (case-insensitive):
 * - true: 'true', '1', 'yes'
 * - false: everything else
 */
function parseFlexibleBoolean(value: string): boolean {
  const normalizedValue = value.toLowerCase().trim();
  return ['true', '1', 'yes'].includes(normalizedValue);
}

/**
 * List questions request validation schema
 * Validates query parameters for question listing with pagination and filtering
 */
export const listQuestionsSchema = z.object({
  // Pagination
  limit: z
    .string()
    .optional()
    .default('10')
    .transform((val) => Number.parseInt(val, 10))
    .refine((val) => val >= 1 && val <= 100, {
      message: 'Limit must be between 1 and 100',
    }),

  offset: z
    .string()
    .optional()
    .default('0')
    .transform((val) => Number.parseInt(val, 10))
    .refine((val) => val >= 0, {
      message: 'Offset must be non-negative',
    }),

  // Filtering
  examTypes: z
    .string()
    .optional()
    .transform((val) => (val ? val.split(',').map((type) => type.trim()) : undefined))
    .refine(
      (val) => {
        if (!val) return true;
        return val.every((type) => type.length > 0 && type.length <= 50);
      },
      {
        message: 'Each exam type must be between 1 and 50 characters',
      }
    ),

  categories: z
    .string()
    .optional()
    .transform((val) => (val ? val.split(',').map((cat) => cat.trim()) : undefined))
    .refine(
      (val) => {
        if (!val) return true;
        return val.every((cat) => cat.length > 0 && cat.length <= 50);
      },
      {
        message: 'Each category must be between 1 and 50 characters',
      }
    ),

  difficulty: QuestionDifficultySchema.optional(),

  searchQuery: z
    .string()
    .optional()
    .refine((val) => !val || (val.length >= 2 && val.length <= 200), {
      message: 'Search query must be between 2 and 200 characters',
    }),

  // Premium content access (will be determined by auth status)
  includePremium: z.string().optional().default('false').transform(parseFlexibleBoolean),

  // Active only filter
  activeOnly: z.string().optional().default('true').transform(parseFlexibleBoolean),
});

/**
 * Inferred type from validation schema
 * This ensures DTO and validation schema never drift apart
 */
export type ListQuestionsRequest = z.infer<typeof listQuestionsSchema>;
