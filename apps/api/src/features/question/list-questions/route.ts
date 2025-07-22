/**
 * List questions route implementation
 * @fileoverview HTTP endpoint for retrieving paginated question lists with filtering
 */

import type { AuthUser } from '@api/middleware/auth/auth-user';
import type { LoggerVariables } from '@api/middleware/logger';
import { Hono } from 'hono';
import type { IQuestionRepository } from '../domain/repositories/IQuestionRepository';
import { mapQuestionError } from '../shared/error-mapper';
import { listQuestionsHandler } from './handler';

// Define context variables for this route
type ListQuestionsVariables = {
  questionRepository: IQuestionRepository;
  user?: AuthUser; // Optional for public access with premium logic
} & LoggerVariables;

export const listQuestionsRoute = new Hono<{
  Variables: ListQuestionsVariables;
}>().get('/', async (c): Promise<Response> => {
  const logger = c.get('logger');

  try {
    // Get query parameters from URL
    const queryParams = {
      limit: c.req.query('limit'),
      offset: c.req.query('offset'),
      examTypes: c.req.query('examTypes'),
      categories: c.req.query('categories'),
      difficulty: c.req.query('difficulty'),
      searchQuery: c.req.query('searchQuery'),
      includePremium: c.req.query('includePremium'),
      activeOnly: c.req.query('activeOnly'),
    };

    // Determine authentication status
    const user = c.get('user');
    const isAuthenticated = !!user;

    logger.info('List questions attempt', {
      isAuthenticated,
      userId: user?.sub,
      queryParams: {
        ...queryParams,
        // Log sensitive params carefully
        hasSearchQuery: !!queryParams.searchQuery,
        searchQueryLength: queryParams.searchQuery?.length || 0,
      },
    });

    // Get dependencies from DI container/context
    const questionRepository = c.get('questionRepository');

    // Delegate to handler
    const result = await listQuestionsHandler(
      queryParams,
      questionRepository,
      logger,
      isAuthenticated
    );

    if (!result.success) {
      const error = result.error;

      // Log question listing failure
      logger.warn('List questions failed', {
        isAuthenticated,
        userId: user?.sub,
        errorType: error.name,
        errorMessage: error.message,
        queryParams: {
          limit: queryParams.limit,
          offset: queryParams.offset,
          examTypes: queryParams.examTypes,
          categories: queryParams.categories,
          difficulty: queryParams.difficulty,
          includePremium: queryParams.includePremium,
          activeOnly: queryParams.activeOnly,
          hasSearchQuery: !!queryParams.searchQuery,
        },
      });

      const { status, body: errorBody } = mapQuestionError(error);
      return c.json(errorBody, status);
    }

    // Log successful question listing
    logger.info('List questions successful', {
      isAuthenticated,
      userId: user?.sub,
      resultCount: result.data.questions.length,
      totalQuestions: result.data.pagination.total,
      pagination: result.data.pagination,
    });

    return c.json({
      success: true,
      data: result.data,
    });
  } catch (error) {
    logger.error('List questions route error', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    const { status, body: errorBody } = mapQuestionError(
      error instanceof Error ? error : new Error('Unknown error')
    );
    return c.json(errorBody, status);
  }
});
