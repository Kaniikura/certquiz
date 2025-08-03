/**
 * List quizzes handler
 * @fileoverview Business logic for admin quiz listing with pagination and filtering
 */

import type { AdminQuizFilters } from '@api/features/quiz/domain/repositories/IQuizRepository';
import { QuizState } from '@api/features/quiz/domain/value-objects/QuizState';
import type { IUnitOfWork } from '@api/infra/db/IUnitOfWork';
import { ValidationError } from '@api/shared/errors';
import { QUIZ_REPO_TOKEN } from '@api/shared/types/RepositoryToken';
import type { ListQuizzesParams, PaginatedResponse, QuizSummary } from './dto';
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
 * @param params - Pagination and filter parameters
 * @param unitOfWork - Unit of work for database operations
 * @returns Paginated list of quizzes
 * @throws {ValidationError} if parameters are invalid
 */
export async function listQuizzesHandler(
  params: ListQuizzesParams,
  unitOfWork: IUnitOfWork
): Promise<PaginatedResponse<QuizSummary>> {
  // Validate input parameters
  const validationResult = listQuizzesSchema.safeParse(params);
  if (!validationResult.success) {
    throw new ValidationError(validationResult.error.errors[0].message);
  }

  const { page = 1, pageSize = 20, state, userId, dateFrom, dateTo } = params;

  // Get repository from unit of work
  const quizRepo = unitOfWork.getRepository(QUIZ_REPO_TOKEN);

  // Build filters object only if at least one filter is provided
  let filters: AdminQuizFilters | undefined;

  if (
    state !== undefined ||
    userId !== undefined ||
    dateFrom !== undefined ||
    dateTo !== undefined
  ) {
    filters = {};

    if (state) {
      filters.state = parseQuizState(state);
    }
    if (userId) {
      filters.userId = userId;
    }
    if (dateFrom) {
      filters.startDate = dateFrom;
    }
    if (dateTo) {
      filters.endDate = dateTo;
    }
  }

  // Fetch paginated quizzes with admin info
  const result = await quizRepo.findAllForAdmin({
    page,
    pageSize,
    filters,
    orderBy: 'startedAt',
    orderDir: 'desc',
  });

  // Map quizzes to summary format with calculated fields
  const items: QuizSummary[] = result.items.map((quiz) => ({
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
  }));

  return {
    items,
    total: result.total,
    page: result.page,
    pageSize: result.pageSize,
    totalPages: Math.ceil(result.total / result.pageSize),
  };
}
