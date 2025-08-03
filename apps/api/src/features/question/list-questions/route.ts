/**
 * List questions route implementation
 * @fileoverview HTTP endpoint for retrieving paginated question lists with filtering
 */

import { getRepositoryFromContext } from '@api/infra/repositories/providers';
import type { LoggerPort } from '@api/shared/logger/LoggerPort';
import { createStandardRoute } from '@api/shared/route/routeConfigHelpers';
import { QUESTION_REPO_TOKEN } from '@api/shared/types/RepositoryToken';

import type { IQuestionRepository } from '../domain/repositories/IQuestionRepository';
import type { IPremiumAccessService } from '../domain/services/IPremiumAccessService';
import { mapQuestionError } from '../shared/error-mapper';
import type { ListQuestionsResponse } from './dto';
import { listQuestionsHandler } from './handler';

export function listQuestionsRoute(premiumAccessService: IPremiumAccessService) {
  return createStandardRoute<
    unknown,
    ListQuestionsResponse,
    {
      questionRepo: IQuestionRepository;
      logger: LoggerPort;
      premiumAccessService: IPremiumAccessService;
    }
  >({
    method: 'get',
    path: '/',
    configOptions: {
      operation: 'list',
      resource: 'questions',
      requiresAuth: false,
      logging: {
        extractLogContext: (_body, context) => {
          const queryParams = {
            limit: context?.req.query('limit'),
            offset: context?.req.query('offset'),
            examTypes: context?.req.query('examTypes'),
            categories: context?.req.query('categories'),
            difficulty: context?.req.query('difficulty'),
            searchQuery: context?.req.query('searchQuery'),
            includePremium: context?.req.query('includePremium'),
            activeOnly: context?.req.query('activeOnly'),
          };
          return {
            ...queryParams,
            hasSearchQuery: !!queryParams.searchQuery,
            searchQueryLength: queryParams.searchQuery?.length || 0,
          };
        },
        extractSuccessLogData: (result) => {
          const data = result as ListQuestionsResponse;
          return {
            resultCount: data.questions.length,
            totalQuestions: data.pagination.total,
            pagination: data.pagination,
          };
        },
      },
      errorMapper: mapQuestionError,
    },
    handler: async (_body, deps, context) => {
      // Get query parameters from URL
      const queryParams = {
        limit: context.req.query('limit'),
        offset: context.req.query('offset'),
        examTypes: context.req.query('examTypes'),
        categories: context.req.query('categories'),
        difficulty: context.req.query('difficulty'),
        searchQuery: context.req.query('searchQuery'),
        includePremium: context.req.query('includePremium'),
        activeOnly: context.req.query('activeOnly'),
      };

      // Determine authentication status
      const user = context.get('user');
      const isAuthenticated = !!user;

      // Delegate to handler
      return listQuestionsHandler(
        queryParams,
        deps.questionRepo,
        deps.logger,
        deps.premiumAccessService,
        isAuthenticated
      );
    },
    getDependencies: (c) => ({
      questionRepo: getRepositoryFromContext(c, QUESTION_REPO_TOKEN),
      logger: c.get('logger'),
      premiumAccessService: premiumAccessService,
    }),
  });
}
