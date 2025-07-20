/**
 * Get results HTTP route
 * @fileoverview HTTP endpoint for retrieving quiz results and scoring
 */

import type { AuthUser } from '@api/middleware/auth/auth-user';
import type { Hono } from 'hono';
import { QuizDependencyProvider } from '../shared/dependencies';
import { createQuizRoute } from '../shared/route-factory';
import type { GetResultsRequest, GetResultsResponse } from './dto';
import { getResultsHandler } from './handler';

/**
 * Create get results route with dependency injection
 */
export function createGetResultsRoute(): Hono<{ Variables: { user: AuthUser } }> {
  const deps = new QuizDependencyProvider();

  return createQuizRoute<GetResultsRequest, GetResultsResponse>({
    method: 'get',
    path: '/:sessionId/results',
    loggerName: 'quiz.get-results',
    services: {
      questionDetailsService: deps.questionDetailsService,
    },
    getLogContext: (_request, params) => ({
      sessionId: params.sessionId,
    }),
    getSuccessLogData: (response) => ({
      state: response.state,
      questionsAnswered: response.answers.length,
      percentage: response.score.percentage,
      canViewResults: response.canViewResults,
    }),
    createTransactionHandler: (_request, context) => {
      return async ({ quizRepository, userId, sessionId }) => {
        if (!sessionId) {
          throw new Error('Session ID is required');
        }
        return getResultsHandler(
          {},
          sessionId,
          userId,
          quizRepository,
          context.services.questionDetailsService as typeof deps.questionDetailsService
        );
      };
    },
  });
}
