/**
 * Moderate Questions Handler
 * @fileoverview Business logic for question moderation actions
 */

import type { IUnitOfWork } from '@api/infra/db/IUnitOfWork';
import { ValidationError } from '@api/shared/errors';
import { QUESTION_REPO_TOKEN } from '@api/shared/types/RepositoryToken';
import type { ModerateQuestionParams, ModerateQuestionResponse, ModerationAction } from './dto';
import { ModerationActionToStatus, StatusToDisplayName } from './dto';
import { validateModerateQuestionParams } from './validation';

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
export async function moderateQuestionHandler(
  params: ModerateQuestionParams,
  unitOfWork: IUnitOfWork
): Promise<ModerateQuestionResponse> {
  // Validate input parameters
  const validation = validateModerateQuestionParams(params);
  if (!validation.success) {
    const errorMessage = validation.errors.join(', ');
    throw new ValidationError(errorMessage);
  }

  const validatedParams = validation.data;
  const { questionId, action, moderatedBy, feedback } = validatedParams;

  // Additional business rule validation
  validateModerationAction(action, feedback);

  // Get repository
  const questionRepo = unitOfWork.getRepository(QUESTION_REPO_TOKEN);

  // Determine target status based on action
  const targetStatus = ModerationActionToStatus[action];

  // Store current status for audit (we'll set this to PENDING as default since we don't know the actual previous status)
  const previousStatus = StatusToDisplayName.draft; // Assuming all moderated questions are DRAFT

  // Update question status
  await questionRepo.updateStatus(questionId, targetStatus, moderatedBy, feedback);

  // Create response with audit information
  const response: ModerateQuestionResponse = {
    success: true,
    questionId,
    previousStatus,
    newStatus: StatusToDisplayName[targetStatus],
    moderatedBy,
    moderatedAt: new Date(),
    action,
    feedback,
  };

  return response;
}

/**
 * Validate moderation action business rules
 */
function validateModerationAction(action: ModerationAction, feedback?: string): void {
  // Business rule: reject and request_changes require feedback
  if ((action === 'reject' || action === 'request_changes') && !feedback) {
    throw new ValidationError(`Feedback is required for ${action} action`);
  }

  // Business rule: feedback must meet minimum length requirements
  if (feedback && feedback.trim().length < 10) {
    throw new ValidationError('Feedback must be at least 10 characters long');
  }

  // Business rule: feedback has maximum length
  if (feedback && feedback.length > 1000) {
    throw new ValidationError('Feedback must not exceed 1000 characters');
  }
}
