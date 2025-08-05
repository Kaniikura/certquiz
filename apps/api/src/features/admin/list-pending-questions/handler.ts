/**
 * List Pending Questions Handler
 * @fileoverview Business logic for listing questions pending moderation
 */

import type {
  IQuestionRepository,
  ModerationParams,
  QuestionWithModerationInfo,
} from '@api/features/question/domain/repositories/IQuestionRepository';
import type { IUnitOfWork } from '@api/infra/db/IUnitOfWork';
import { createPaginatedListHandlerWithUow } from '@api/shared/handler/list-handler-utils';
import { QUESTION_REPO_TOKEN } from '@api/shared/types/RepositoryToken';
import type {
  ListPendingQuestionsParams,
  ListPendingQuestionsResponse,
  PendingQuestionInfo,
} from './dto';
import { calculatePriority, StatusToQuestionStatus } from './dto';
import { ListPendingQuestionsParamsSchema } from './validation';

/**
 * Handler for listing questions pending moderation
 *
 * Uses the generic list handler utility to reduce code duplication
 * and maintain consistency with other list endpoints
 */
export const listPendingQuestionsHandler = createPaginatedListHandlerWithUow<
  ListPendingQuestionsParams,
  PendingQuestionInfo,
  IUnitOfWork,
  ModerationParams,
  QuestionWithModerationInfo,
  IQuestionRepository,
  ListPendingQuestionsResponse['summary']
>({
  schema: ListPendingQuestionsParamsSchema,

  getRepository: (unitOfWork) => unitOfWork.getRepository(QUESTION_REPO_TOKEN),

  buildFilters: (params) => {
    // Build moderation query parameters
    return {
      page: params.page,
      pageSize: params.pageSize,
      orderBy: params.orderBy || 'createdAt',
      orderDir: params.orderDir || 'desc',
      ...(params.status && {
        status: StatusToQuestionStatus[params.status],
      }),
      ...(params.dateFrom && { dateFrom: params.dateFrom }),
      ...(params.dateTo && { dateTo: params.dateTo }),
      ...(params.examType && { examType: params.examType }),
      ...(params.difficulty && { difficulty: params.difficulty }),
    };
  },

  fetchData: async (repo, filters, _params) => {
    return repo.findQuestionsForModeration(filters);
  },

  transformItem: transformQuestionToInfo,

  calculateSummary: (items, total) => calculateSummaryStatistics(items, total),
});

/**
 * Transform QuestionWithModerationInfo to PendingQuestionInfo
 */
function transformQuestionToInfo(question: QuestionWithModerationInfo): PendingQuestionInfo {
  const priority = calculatePriority(question.daysPending);

  return {
    questionId: question.questionId,
    questionText: question.questionText,
    questionType: question.questionType,
    examTypes: question.examTypes,
    categories: question.categories,
    difficulty: question.difficulty,
    status: question.status, // Preserve actual status for filtering
    isPremium: question.isPremium,
    tags: question.tags,
    createdById: question.createdById,
    createdAt: question.createdAt,
    updatedAt: question.updatedAt,
    daysPending: question.daysPending,
    priority,
  };
}

/**
 * Calculate summary statistics for the question list
 */
function calculateSummaryStatistics(
  items: PendingQuestionInfo[],
  totalCount: number
): ListPendingQuestionsResponse['summary'] {
  if (items.length === 0) {
    return {
      totalPending: totalCount,
      averageDaysPending: 0,
      priorityCounts: {
        low: 0,
        medium: 0,
        high: 0,
        urgent: 0,
      },
    };
  }

  // Calculate average days pending from current page items
  const totalDaysPending = items.reduce((sum, item) => sum + item.daysPending, 0);
  const averageDaysPending = totalDaysPending / items.length;

  // Count priorities in current page
  const priorityCounts = items.reduce(
    (counts, item) => {
      counts[item.priority]++;
      return counts;
    },
    { low: 0, medium: 0, high: 0, urgent: 0 }
  );

  return {
    totalPending: totalCount,
    averageDaysPending: Number(averageDaysPending.toFixed(1)),
    priorityCounts,
  };
}
