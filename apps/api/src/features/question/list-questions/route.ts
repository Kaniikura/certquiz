/**
 * List questions route implementation
 * @fileoverview HTTP endpoint for retrieving paginated question lists with filtering
 */

import { getQuestionRepository } from '@api/infra/repositories/providers';
import type { AuthUser } from '@api/middleware/auth/auth-user';
import type { LoggerVariables } from '@api/middleware/logger';
import type { TransactionVariables } from '@api/middleware/transaction';
import type { LoggerPort } from '@api/shared/logger/LoggerPort';
import { createAmbientRoute } from '@api/shared/route';
import { Hono } from 'hono';
import type { IQuestionRepository } from '../domain/repositories/IQuestionRepository';
import type { IPremiumAccessService } from '../domain/services';
import { mapQuestionError } from '../shared/error-mapper';
import type { ListQuestionsResponse } from './dto';
import { listQuestionsHandler } from './handler';

// Define context variables for this route
type ListQuestionsVariables = {
  user?: AuthUser; // Optional for public access with premium logic
} & LoggerVariables &
  TransactionVariables;

export function listQuestionsRoute(premiumAccessService: IPremiumAccessService) {
  return new Hono<{
    Variables: ListQuestionsVariables;
  }>().get('/', (c) => {
    const route = createAmbientRoute<
      unknown,
      ListQuestionsResponse,
      {
        questionRepo: IQuestionRepository;
        logger: LoggerPort;
        premiumAccessService: IPremiumAccessService;
      },
      ListQuestionsVariables
    >(
      {
        operation: 'list',
        resource: 'questions',
        requiresAuth: false,
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
        errorMapper: mapQuestionError,
      },
      async (
        _body,
        deps: {
          questionRepo: IQuestionRepository;
          logger: LoggerPort;
          premiumAccessService: IPremiumAccessService;
        },
        context
      ) => {
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
      }
    );

    // Inject dependencies
    return route(c, {
      questionRepo: getQuestionRepository(c),
      logger: c.get('logger'),
      premiumAccessService: premiumAccessService,
    });
  });
}
