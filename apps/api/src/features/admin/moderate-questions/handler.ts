/**
 * Moderate Questions Handler
 * @fileoverview Business logic for question moderation actions
 */

import type { Question } from '@api/features/question/domain/entities/Question';
import type { IQuestionRepository } from '@api/features/question/domain/repositories/IQuestionRepository';
import { QuestionId } from '@api/features/quiz/domain/value-objects/Ids';
import type { IUnitOfWork } from '@api/infra/db/IUnitOfWork';
import { ValidationError } from '@api/shared/errors';
import { createAdminActionHandler } from '@api/shared/handler/admin-handler-utils';
import { QUESTION_REPO_TOKEN } from '@api/shared/types/RepositoryToken';
import { escape as escapeHtml } from 'he';
import { z } from 'zod';
import type { ModerateQuestionParams, ModerateQuestionResponse } from './dto';
import { ModerationActionToStatus, StatusToDisplayName } from './dto';

/**
 * Input type for schema validation (before transformation)
 */
export interface ModerateQuestionInput {
  questionId: string;
  action: 'approve' | 'reject' | 'request_changes';
  moderatedBy: string;
  feedback?: string;
}

/**
 * Zod schema for moderation parameters
 * Extracted inline to avoid circular dependencies
 */
const moderateQuestionSchema = z
  .object({
    questionId: z
      .string()
      .uuid({ message: 'Must be a valid UUID' })
      .transform((id) => QuestionId.of(id)),
    action: z.enum(['approve', 'reject', 'request_changes'] as const, {
      errorMap: () => ({ message: 'Action must be approve, reject, or request_changes' }),
    }),
    moderatedBy: z.string().uuid({ message: 'Must be a valid UUID' }),
    feedback: z
      .string()
      .min(10, { message: 'Feedback must be at least 10 characters long' })
      .max(1000, { message: 'Feedback must not exceed 1000 characters' })
      .optional(),
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
 * Handle question moderation actions
 *
 * @param params - Moderation parameters
 * @param unitOfWork - Unit of work for database operations
 * @returns Moderation response with audit information
 *
 * @throws {ValidationError} Invalid parameters or business rule violations
 * @throws {NotFoundError} Question not found
 * @throws {InvalidQuestionDataError} Invalid status transition or missing feedback
 */
/**
 * Wrapper handler that processes input through the schema transformation
 */
export const moderateQuestionHandler = async (
  inputParams: ModerateQuestionInput,
  unitOfWork: IUnitOfWork
): Promise<ModerateQuestionResponse> => {
  // Transform input through schema to get properly typed params
  const validationResult = moderateQuestionSchema.safeParse(inputParams);
  if (!validationResult.success) {
    throw new ValidationError(validationResult.error.errors[0].message);
  }

  const params = validationResult.data;

  // Use the internal handler with transformed params
  return internalModerateQuestionHandler(params, unitOfWork);
};

/**
 * Internal handler with proper types after transformation
 */
const internalModerateQuestionHandler = createAdminActionHandler<
  ModerateQuestionParams,
  Question,
  IQuestionRepository,
  ModerateQuestionResponse,
  IUnitOfWork
>({
  schema: z.custom<ModerateQuestionParams>(() => true), // Skip validation as it's already done

  getRepository: (unitOfWork) => unitOfWork.getRepository(QUESTION_REPO_TOKEN),

  findEntity: async (repo, params) => {
    return repo.findQuestionWithDetails(params.questionId);
  },

  notFoundMessage: 'Question not found',

  validateBusinessRules: async (_question, _params) => {
    // Business rules are enforced by the repository's updateStatus method
    // No additional validation needed here
  },

  executeAction: async (repo, _question, params) => {
    const { questionId, action, moderatedBy, feedback } = params;

    // Determine target status based on action
    const targetStatus = ModerationActionToStatus[action];

    // Escape feedback to prevent XSS attacks
    const sanitizedFeedback = feedback ? escapeHtml(feedback) : feedback;

    // Update question status (this will also enforce business rules internally)
    await repo.updateStatus(questionId, targetStatus, moderatedBy, sanitizedFeedback);
  },

  buildResponse: (question, params) => {
    const { questionId, action, moderatedBy, feedback } = params;
    const targetStatus = ModerationActionToStatus[action];

    // Return sanitized feedback in response
    const sanitizedFeedback = feedback ? escapeHtml(feedback) : feedback;

    return {
      success: true,
      questionId,
      previousStatus: StatusToDisplayName[question.status],
      newStatus: StatusToDisplayName[targetStatus],
      moderatedBy,
      moderatedAt: new Date(),
      action,
      feedback: sanitizedFeedback,
    };
  },
});
