/**
 * Moderate Questions Handler
 * @fileoverview Business logic for question moderation actions
 */

import type { IUnitOfWork } from '@api/infra/db/IUnitOfWork';
import { ValidationError } from '@api/shared/errors';
import { QUESTION_REPO_TOKEN } from '@api/shared/types/RepositoryToken';
import { QuestionNotFoundError } from '../../question/shared/errors';
import type { ModerateQuestionParams, ModerateQuestionResponse } from './dto';
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

  // Get repository
  const questionRepo = unitOfWork.getRepository(QUESTION_REPO_TOKEN);

  // First fetch the question to confirm it exists and get its current status
  const questionEntity = await questionRepo.findQuestionWithDetails(questionId);
  if (!questionEntity) {
    throw new QuestionNotFoundError(`Question with ID ${questionId} not found`);
  }

  // Get the actual current status for accurate audit logging
  const previousStatus = StatusToDisplayName[questionEntity.status];

  // Determine target status based on action
  const targetStatus = ModerationActionToStatus[action];

  // Update question status (this will also enforce business rules internally)
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
