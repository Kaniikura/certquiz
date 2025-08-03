/**
 * Start quiz HTTP route
 * @fileoverview HTTP endpoint for creating new quiz sessions using route utilities
 */

import { UserId } from '@api/features/auth/domain/value-objects/UserId';
import { getRepositoryFromContext } from '@api/infra/repositories/providers';
import type { AuthUser } from '@api/middleware/auth/auth-user';
import type { Clock } from '@api/shared/clock';
import { createStandardRoute } from '@api/shared/route/routeConfigHelpers';
import { QUIZ_REPO_TOKEN } from '@api/shared/types/RepositoryToken';
import { zValidator } from '@hono/zod-validator';
import type { IQuizRepository } from '../domain/repositories/IQuizRepository';
import { QuizDependencyProvider } from '../shared/dependencies';
import { mapStartQuizError } from '../shared/error-mapper';
import type { StartQuizRequest, StartQuizResponse } from './dto';
import { startQuizHandler } from './handler';
import type { StubQuestionService } from './QuestionService';
import { startQuizSchema } from './validation';

/**
 * Create start quiz route
 */
export function startQuizRoute(clock: Clock) {
  const deps = new QuizDependencyProvider();
  const questionService = deps.startQuizQuestionService;

  return createStandardRoute<
    StartQuizRequest,
    StartQuizResponse,
    {
      quizRepo: IQuizRepository;
      questionService: StubQuestionService;
      clock: Clock;
    }
  >({
    method: 'post',
    path: '/start',
    validator: zValidator('json', startQuizSchema),
    configOptions: {
      operation: 'start',
      resource: 'quiz',
      requiresAuth: true,
      successStatusCode: 201,
      logging: {
        extractLogContext: (body) => {
          const request = body as StartQuizRequest;
          return {
            examType: request.examType,
            questionCount: request.questionCount,
          };
        },
        extractSuccessLogData: (result) => {
          const response = result as StartQuizResponse;
          return {
            sessionId: response.sessionId,
            totalQuestions: response.totalQuestions,
            expiresAt: response.expiresAt,
          };
        },
      },
      errorMapper: mapStartQuizError,
    },
    handler: async (body, deps, context) => {
      const request = body as StartQuizRequest;
      const user = context.get('user') as AuthUser;
      const userId = UserId.of(user.sub);

      return startQuizHandler(request, userId, deps.quizRepo, deps.questionService, deps.clock);
    },
    getDependencies: (c) => ({
      quizRepo: getRepositoryFromContext(c, QUIZ_REPO_TOKEN),
      questionService: questionService,
      clock: clock,
    }),
  });
}
