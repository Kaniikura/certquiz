/**
 * Get results HTTP route
 * @fileoverview HTTP endpoint for retrieving quiz results and scoring using route utilities
 */

import { UserId } from '@api/features/auth/domain/value-objects/UserId';
import { getRepositoryFromContext } from '@api/infra/repositories/providers';
import type { AuthUser } from '@api/middleware/auth/auth-user';
import type { Clock } from '@api/shared/clock';
import { ValidationError } from '@api/shared/errors';
import { Result } from '@api/shared/result';
import { createStandardRoute } from '@api/shared/route/routeConfigHelpers';
import { QUIZ_REPO_TOKEN } from '@api/shared/types/RepositoryToken';
import { isValidUUID } from '@api/shared/validation/constants';
import type { IQuizRepository } from '../domain/repositories/IQuizRepository';
import { QuizSessionId } from '../domain/value-objects/Ids';
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

  return createStandardRoute<
    unknown,
    GetResultsResponse,
    {
      quizRepo: IQuizRepository;
      questionDetailsService: StubQuestionDetailsService;
    }
  >({
    method: 'get',
    path: '/:sessionId/results',
    configOptions: {
      operation: 'get',
      resource: 'results',
      requiresAuth: true,
      logging: {
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
      },
      errorMapper: mapGetResultsError,
    },
    handler: async (_body, deps, context) => {
      const user = context.get('user') as AuthUser;
      const sessionId = context.req.param('sessionId');

      // Validate session ID
      if (!sessionId || !isValidUUID(sessionId)) {
        return Result.fail(new ValidationError('Invalid session ID format. Expected UUID.'));
      }

      const userIdVO = UserId.of(user.sub);
      const sessionIdVO = QuizSessionId.of(sessionId);

      return getResultsHandler(
        {},
        sessionIdVO,
        userIdVO,
        deps.quizRepo,
        deps.questionDetailsService
      );
    },
    getDependencies: (c) => ({
      quizRepo: getRepositoryFromContext(c, QUIZ_REPO_TOKEN),
      questionDetailsService: questionDetailsService,
    }),
  });
}
