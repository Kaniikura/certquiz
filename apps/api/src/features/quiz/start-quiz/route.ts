/**
 * Start quiz HTTP route
 * @fileoverview HTTP endpoint for creating new quiz sessions using route utilities
 */

import { getRepositoryFromContext } from '@api/infra/repositories/providers';
import type { AuthUser } from '@api/middleware/auth/auth-user';
import type { LoggerVariables } from '@api/middleware/logger';
import type { DatabaseContextVariables } from '@api/middleware/transaction';
import type { Clock } from '@api/shared/clock';
import { createAmbientRoute } from '@api/shared/route/route-builder';
import { QUIZ_REPO_TOKEN } from '@api/shared/types/RepositoryToken';
import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import type { IQuizRepository } from '../domain/repositories/IQuizRepository';
import { UserId } from '../domain/value-objects/Ids';
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

  return new Hono<{
    Variables: { user: AuthUser } & LoggerVariables & DatabaseContextVariables;
  }>().post('/start', zValidator('json', startQuizSchema), (c) => {
    const route = createAmbientRoute<
      StartQuizRequest,
      StartQuizResponse,
      {
        quizRepo: IQuizRepository;
        questionService: StubQuestionService;
        clock: Clock;
      },
      { user: AuthUser } & LoggerVariables & DatabaseContextVariables
    >(
      {
        operation: 'start',
        resource: 'quiz',
        requiresAuth: true,
        successStatusCode: 201,
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
        errorMapper: mapStartQuizError,
      },
      async (
        body,
        routeDeps: {
          quizRepo: IQuizRepository;
          questionService: StubQuestionService;
          clock: Clock;
        },
        context
      ) => {
        const request = body as StartQuizRequest;
        const user = context.get('user') as AuthUser;
        const userId = UserId.of(user.sub);

        return startQuizHandler(
          request,
          userId,
          routeDeps.quizRepo,
          routeDeps.questionService,
          routeDeps.clock
        );
      }
    );

    // Inject dependencies
    return route(c, {
      quizRepo: getRepositoryFromContext(c, QUIZ_REPO_TOKEN),
      questionService: questionService,
      clock: clock,
    });
  });
}
