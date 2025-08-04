/**
 * Delete quiz handler
 * @fileoverview Business logic for admin quiz deletion with cascading cleanup
 */

import { QuizSessionId } from '@api/features/quiz/domain/value-objects/Ids';
import { QuizState } from '@api/features/quiz/domain/value-objects/QuizState';
import type { IUnitOfWork } from '@api/infra/db/IUnitOfWork';
import { NotFoundError, ValidationError } from '@api/shared/errors';
import { QUIZ_REPO_TOKEN } from '@api/shared/types/RepositoryToken';
import { AdminPermissionError } from '../shared/admin-errors';
import type { DeleteQuizParams, DeleteQuizResponse } from './dto';
import { deleteQuizSchema } from './validation';

/**
 * Handler for deleting quiz sessions with cascading cleanup
 * @param params - Deletion parameters including quiz ID, admin user, and reason
 * @param unitOfWork - Unit of work for database operations
 * @returns Deletion confirmation with audit metadata
 * @throws {ValidationError} if parameters are invalid
 * @throws {NotFoundError} if quiz session not found
 * @throws {AdminPermissionError} if quiz cannot be deleted (e.g., active session)
 */
export async function deleteQuizHandler(
  params: DeleteQuizParams,
  unitOfWork: IUnitOfWork
): Promise<DeleteQuizResponse> {
  // Validate input parameters
  const validationResult = deleteQuizSchema.safeParse(params);
  if (!validationResult.success) {
    throw new ValidationError(validationResult.error.errors[0].message);
  }

  const { quizId, deletedBy, reason } = params;

  // Create properly typed QuizSessionId
  const quizSessionId = QuizSessionId.of(quizId);

  // Get repository from unit of work
  const quizRepo = unitOfWork.getRepository(QUIZ_REPO_TOKEN);

  // Find the quiz session by ID
  const quiz = await quizRepo.findById(quizSessionId);
  if (!quiz) {
    throw new NotFoundError('Quiz session not found');
  }

  // Check if quiz can be deleted (only COMPLETED or EXPIRED quizzes)
  const currentState = quiz.state;
  if (currentState === QuizState.InProgress) {
    throw new AdminPermissionError(
      'Cannot delete active quiz session. Only completed or expired quizzes can be deleted.'
    );
  }

  // Perform cascading deletion
  try {
    await quizRepo.deleteWithCascade(quizSessionId);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown deletion error';
    throw new Error(`Failed to delete quiz session: ${errorMessage}`);
  }

  // Return audit metadata
  return {
    success: true,
    quizId,
    previousState: currentState.toString(),
    deletedBy,
    reason,
    deletedAt: new Date(),
  };
}
