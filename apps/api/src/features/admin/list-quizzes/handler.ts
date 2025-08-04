/**
 * List quizzes handler
 * @fileoverview Business logic for admin quiz listing with pagination and filtering
 */

import type {
  AdminQuizFilters,
  AdminQuizParams,
  IQuizRepository,
  QuizWithUserInfo,
} from '@api/features/quiz/domain/repositories/IQuizRepository';
import { QuizState } from '@api/features/quiz/domain/value-objects/QuizState';
import type { IUnitOfWork } from '@api/infra/db/IUnitOfWork';
import { ValidationError } from '@api/shared/errors';
import { buildMappedFilters } from '@api/shared/handler/filter-utils';
import { createPaginatedListHandlerWithUow } from '@api/shared/handler/list-handler-utils';
import { buildPaginationOptions } from '@api/shared/handler/pagination-utils';
import { createRepositoryFetch } from '@api/shared/handler/repository-utils';
import { QUIZ_REPO_TOKEN } from '@api/shared/types/RepositoryToken';
import type { ListQuizzesParams, QuizSummary } from './dto';
import { listQuizzesSchema } from './validation';

/**
 * Convert string state to QuizState enum
 */
function parseQuizState(state: string): QuizState {
  switch (state) {
    case 'IN_PROGRESS':
      return QuizState.InProgress;
    case 'COMPLETED':
      return QuizState.Completed;
    case 'EXPIRED':
      return QuizState.Expired;
    default:
      throw new ValidationError(`Invalid quiz state: ${state}`);
  }
}

/**
 * Handler for listing quizzes with pagination and filters
 *
 * Uses the generic list handler utility to reduce code duplication
 * and maintain consistency with other list endpoints
 */
export const listQuizzesHandler = createPaginatedListHandlerWithUow<
  ListQuizzesParams,
  QuizSummary,
  IUnitOfWork,
  AdminQuizFilters | undefined,
  QuizWithUserInfo,
  IQuizRepository
>({
  schema: listQuizzesSchema,

  getRepository: (unitOfWork) => unitOfWork.getRepository(QUIZ_REPO_TOKEN),

  buildFilters: (params) =>
    buildMappedFilters(params, {
      state: (value) => parseQuizState(value as string),
      userId: 'userId',
      dateFrom: 'startDate',
      dateTo: 'endDate',
    }),

  fetchData: createRepositoryFetch<
    'findAllForAdmin',
    AdminQuizFilters | undefined,
    QuizWithUserInfo,
    AdminQuizParams,
    IQuizRepository
  >(
    'findAllForAdmin',
    (filters, pagination) =>
      ({
        ...buildPaginationOptions(pagination, { orderBy: 'startedAt', orderDir: 'desc' }),
        filters,
      }) as AdminQuizParams
  ),

  transformItem: (quiz) => ({
    sessionId: quiz.sessionId,
    userId: quiz.userId,
    userEmail: quiz.userEmail,
    state: quiz.state.toString(), // Convert enum to string
    score: quiz.score !== null ? Math.round(quiz.score * 100) : null, // Convert to percentage
    questionCount: quiz.questionCount,
    startedAt: quiz.startedAt,
    completedAt: quiz.completedAt,
    duration: quiz.completedAt
      ? Math.round((quiz.completedAt.getTime() - quiz.startedAt.getTime()) / 1000)
      : null, // Duration in seconds
  }),
});
