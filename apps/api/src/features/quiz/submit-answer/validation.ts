/**
 * Submit answer validation schemas
 * @fileoverview Zod schemas for submit answer request validation
 */

import { z } from 'zod';

export const submitAnswerSchema = z.object({
  questionId: z.string().min(1, 'Question ID is required').max(100, 'Question ID too long'),

  selectedOptionIds: z
    .array(z.string().min(1, 'Option ID cannot be empty'))
    .min(1, 'At least one option must be selected')
    .max(10, 'Too many options selected')
    .refine(
      (options) => new Set(options).size === options.length,
      'Duplicate option IDs are not allowed'
    ),
});

export type SubmitAnswerSchemaType = z.infer<typeof submitAnswerSchema>;
