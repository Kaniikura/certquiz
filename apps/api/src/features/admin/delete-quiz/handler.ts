/**
 * Delete quiz handler
 * @fileoverview Business logic for admin quiz deletion with cascading cleanup
 */

import type { QuizSession } from '@api/features/quiz/domain/aggregates/QuizSession';
import type { IQuizRepository } from '@api/features/quiz/domain/repositories/IQuizRepository';
import { QuizSessionId } from '@api/features/quiz/domain/value-objects/Ids';
import { QuizState } from '@api/features/quiz/domain/value-objects/QuizState';
import type { IUnitOfWork } from '@api/infra/db/IUnitOfWork';
import { createAdminActionHandler } from '@api/shared/handler/admin-handler-utils';
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
export const deleteQuizHandler = createAdminActionHandler<
  DeleteQuizParams,
  DeleteQuizParams,
  QuizSession,
  IQuizRepository,
  DeleteQuizResponse,
  IUnitOfWork
>({
  schema: deleteQuizSchema,

  getRepository: (unitOfWork) => unitOfWork.getRepository(QUIZ_REPO_TOKEN),

  findEntity: async (repo, params) => {
    const quizSessionId = QuizSessionId.of(params.quizId);
    return repo.findById(quizSessionId);
  },

  notFoundMessage: 'Quiz session not found',

  validateBusinessRules: (quiz) => {
    // Check if quiz can be deleted (only COMPLETED or EXPIRED quizzes)
    if (quiz.state === QuizState.InProgress) {
      throw new AdminPermissionError(
        'Cannot delete active quiz session. Only completed or expired quizzes can be deleted.'
      );
    }
  },

  executeAction: async (repo, quiz) => {
    // Perform cascading deletion
    // QuizRepositoryError will be thrown with proper context if deletion fails
    await repo.deleteWithCascade(quiz.id);
  },

  buildResponse: (quiz, params) => ({
    success: true,
    quizId: params.quizId,
    previousState: quiz.state.toString(),
    deletedBy: params.deletedBy,
    reason: params.reason,
    deletedAt: new Date(),
  }),
});
