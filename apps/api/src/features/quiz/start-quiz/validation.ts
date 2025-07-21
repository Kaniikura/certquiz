/**
 * Start quiz validation schemas
 * @fileoverview Zod schemas for request validation
 */

import { z } from 'zod';
import { QuizConfig } from '../domain/value-objects/QuizConfig';

/**
 * Validation schema for start quiz request
 */
export const startQuizSchema = z.object({
  examType: z.string().min(1).max(50),
  category: z.string().min(1).max(100).optional(),
  questionCount: z
    .number()
    .int()
    .min(1)
    .max(QuizConfig.MAX_QUESTION_COUNT)
    .describe('Number of questions in the quiz'),
  timeLimit: z
    .number()
    .int()
    .min(60)
    .max(24 * 60 * 60) // 24 hours max
    .optional()
    .describe('Time limit in seconds (minimum 60 seconds)'),
  difficulty: z.enum(['BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'MIXED']).optional().default('MIXED'),
  enforceSequentialAnswering: z.boolean().optional().default(false),
  requireAllAnswers: z.boolean().optional().default(false),
  autoCompleteWhenAllAnswered: z.boolean().optional().default(true),
  fallbackLimitSeconds: z
    .number()
    .int()
    .min(60)
    .max(24 * 60 * 60)
    .optional()
    .default(QuizConfig.DEFAULT_FALLBACK_LIMIT_SECONDS),
});

export type StartQuizInput = z.infer<typeof startQuizSchema>;
