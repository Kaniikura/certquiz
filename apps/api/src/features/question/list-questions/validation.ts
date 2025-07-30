/**
 * List questions request validation schema
 * @fileoverview Zod schema for question listing input validation with type inference
 */

import { parseCommaSeparated, parseFlexibleBoolean } from '@api/shared/validation/query-params';
import { z } from 'zod';
import { QUESTION_DIFFICULTY_VALUES } from '../domain';

/**
 * Available question difficulties for filtering
 */
const QuestionDifficultySchema = z.enum(QUESTION_DIFFICULTY_VALUES);

/**
 * Pagination limit schema - validates limit parameter
 */
const limitSchema = z
  .string()
  .optional()
  .default('10')
  .transform((val) => Number.parseInt(val, 10))
  .refine((val) => val >= 1 && val <= 100, {
    message: 'Limit must be between 1 and 100',
  });

/**
 * Pagination offset schema - validates offset parameter
 */
const offsetSchema = z
  .string()
  .optional()
  .default('0')
  .transform((val) => Number.parseInt(val, 10))
  .refine((val) => val >= 0, {
    message: 'Offset must be non-negative',
  });

/**
 * Exam types filter schema - validates comma-separated exam types
 */
const examTypesSchema = z
  .string()
  .optional()
  .transform(parseCommaSeparated)
  .refine(
    (val) => {
      if (!val) return true;
      return val.every((type) => type.length > 0 && type.length <= 50);
    },
    {
      message: 'Each exam type must be between 1 and 50 characters',
    }
  );

/**
 * Categories filter schema - validates comma-separated categories
 */
const categoriesSchema = z
  .string()
  .optional()
  .transform(parseCommaSeparated)
  .refine(
    (val) => {
      if (!val) return true;
      return val.every((cat) => cat.length > 0 && cat.length <= 50);
    },
    {
      message: 'Each category must be between 1 and 50 characters',
    }
  );

/**
 * Search query schema - validates search text
 */
const searchQuerySchema = z
  .string()
  .optional()
  .refine((val) => !val || (val.length >= 2 && val.length <= 200), {
    message: 'Search query must be between 2 and 200 characters',
  });

/**
 * Include premium content schema - transforms string to boolean
 */
const includePremiumSchema = z.string().optional().default('false').transform(parseFlexibleBoolean);

/**
 * Active only filter schema - transforms string to boolean
 */
const activeOnlySchema = z.string().optional().default('true').transform(parseFlexibleBoolean);

/**
 * List questions request validation schema
 * Validates query parameters for question listing with pagination and filtering
 *
 * Performance optimized: Field schemas are pre-defined as constants to avoid
 * recreating schema objects on each validation call
 */
export const listQuestionsSchema = z.object({
  // Pagination
  limit: limitSchema,
  offset: offsetSchema,

  // Filtering
  examTypes: examTypesSchema,
  categories: categoriesSchema,
  difficulty: QuestionDifficultySchema.optional(),
  searchQuery: searchQuerySchema,

  // Premium content access (will be determined by auth status)
  includePremium: includePremiumSchema,

  // Active only filter
  activeOnly: activeOnlySchema,
});

/**
 * Inferred type from validation schema
 * This ensures DTO and validation schema never drift apart
 */
export type ListQuestionsRequest = z.infer<typeof listQuestionsSchema>;
