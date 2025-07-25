/**
 * Get results HTTP route
 * @fileoverview HTTP endpoint for retrieving quiz results and scoring using route utilities
 */

import { getQuizRepository } from '@api/infra/repositories/providers';
import type { AuthUser } from '@api/middleware/auth/auth-user';
import type { LoggerVariables } from '@api/middleware/logger';
import type { TransactionVariables } from '@api/middleware/transaction';
import type { Clock } from '@api/shared/clock';
import { createAmbientRoute } from '@api/shared/route';
import { Hono } from 'hono';
import type { IQuizRepository } from '../domain/repositories/IQuizRepository';
import { QuizSessionId, UserId } from '../domain/value-objects/Ids';
import type { StubQuestionDetailsService } from '../domain/value-objects/QuestionDetailsService';
import { QuizDependencyProvider } from '../shared/dependencies';
import { mapGetResultsError } from '../shared/error-mapper';
import type { GetResultsResponse } from './dto';
import { getResultsHandler } from './handler';

/**
 * Create get results route
 * Clock is passed for consistency but not used in this route
 */
export function getResultsRoute(_clock: Clock) {
  const deps = new QuizDependencyProvider();
  const questionDetailsService = deps.questionDetailsService;

  return new Hono<{ Variables: { user: AuthUser } & LoggerVariables & TransactionVariables }>().get(
    '/:sessionId/results',
    (c) => {
      const route = createAmbientRoute<
        unknown,
        GetResultsResponse,
        {
          quizRepo: IQuizRepository;
          questionDetailsService: StubQuestionDetailsService;
        },
        { user: AuthUser } & LoggerVariables & TransactionVariables
      >(
        {
          operation: 'get',
          resource: 'results',
          requiresAuth: true,
          extractLogContext: (_body, c) => {
            const sessionId = c?.req.param('sessionId');
            return { sessionId };
          },
          extractSuccessLogData: (result, c) => {
            const response = result as GetResultsResponse;
            const sessionId = c?.req.param('sessionId');
            return {
              sessionId,
              state: response.state,
              questionsAnswered: response.answers.length,
              percentage: response.score.percentage,
              canViewResults: response.canViewResults,
            };
          },
          errorMapper: mapGetResultsError,
        },
        async (
          _body,
          routeDeps: {
            quizRepo: IQuizRepository;
            questionDetailsService: StubQuestionDetailsService;
          },
          context
        ) => {
          const user = context.get('user') as AuthUser;
          const sessionId = context.req.param('sessionId');

          const userIdVO = UserId.of(user.sub);
          const sessionIdVO = QuizSessionId.of(sessionId);

          return getResultsHandler(
            {},
            sessionIdVO,
            userIdVO,
            routeDeps.quizRepo,
            routeDeps.questionDetailsService
          );
        }
      );

      // Inject dependencies
      return route(c, {
        quizRepo: getQuizRepository(c),
        questionDetailsService: questionDetailsService,
      });
    }
  );
}
