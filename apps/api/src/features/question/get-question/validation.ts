/**
 * Get question request validation schema
 * @fileoverview Zod schema for single question retrieval input validation with type inference
 */

import { z } from 'zod';

/**
 * Get question request validation schema
 * Validates question ID for detailed question retrieval
 */
export const getQuestionSchema = z.object({
  questionId: z.string().min(1, 'Question ID is required').uuid('Invalid question ID format'),
});

/**
 * Inferred type from validation schema
 * This ensures DTO and validation schema never drift apart
 */
export type GetQuestionRequest = z.infer<typeof getQuestionSchema>;
