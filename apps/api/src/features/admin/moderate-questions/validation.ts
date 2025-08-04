/**
 * Moderate Questions Validation
 * @fileoverview Zod schemas for question moderation validation
 */

import type { ValidationResult } from '@api/shared/validation/zod-utils';
import { validateWithSchema } from '@api/shared/validation/zod-utils';
import { z } from 'zod';
import type { ModerateQuestionParams } from './dto';

/**
 * Zod schema for moderation actions
 */
const ModerationActionSchema = z.enum(['approve', 'reject', 'request_changes'], {
  errorMap: () => ({ message: 'Action must be approve, reject, or request_changes' }),
});

/**
 * UUID validation schema
 */
const UuidSchema = z.string().uuid({
  message: 'Must be a valid UUID',
});

/**
 * Feedback validation schema
 */
const FeedbackSchema = z
  .string()
  .min(10, {
    message: 'Feedback must be at least 10 characters long',
  })
  .max(1000, {
    message: 'Feedback must not exceed 1000 characters',
  });

/**
 * Validation schema for moderate question parameters
 */
const ModerateQuestionParamsSchema = z
  .object({
    questionId: UuidSchema,
    action: ModerationActionSchema,
    moderatedBy: UuidSchema,
    feedback: FeedbackSchema.optional(),
  })
  .refine(
    (data) => {
      // Business rule: reject and request_changes require feedback
      if ((data.action === 'reject' || data.action === 'request_changes') && !data.feedback) {
        return false;
      }
      return true;
    },
    (data) => ({
      message: `Feedback is required for ${data.action} action`,
      path: ['feedback'],
    })
  );

/**
 * Type-safe validation function for moderation parameters
 * Uses the shared validation utility to avoid code duplication
 */
export function validateModerateQuestionParams(
  data: unknown
): ValidationResult<ModerateQuestionParams> {
  const result = validateWithSchema(ModerateQuestionParamsSchema, data);

  if (result.success) {
    // Cast the result to include the branded type
    return {
      success: true,
      data: result.data as ModerateQuestionParams,
    };
  }

  return result;
}
