/**
 * Submit answer HTTP route
 * @fileoverview HTTP endpoint for submitting answers to quiz questions using route utilities
 */

import { getRepository } from '@api/infra/repositories/providers';
import type { AuthUser } from '@api/middleware/auth/auth-user';
import type { LoggerVariables } from '@api/middleware/logger';
import type { TransactionVariables } from '@api/middleware/transaction';
import type { Clock } from '@api/shared/clock';
import { ValidationError } from '@api/shared/errors';
import { Result } from '@api/shared/result';
import { createAmbientRoute } from '@api/shared/route';
import { QUIZ_REPO_TOKEN } from '@api/shared/types/RepositoryToken';
import { isValidUUID } from '@api/shared/validation';
import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import type { IQuizRepository } from '../domain/repositories/IQuizRepository';
import { QuizSessionId, UserId } from '../domain/value-objects/Ids';
import { QuizDependencyProvider } from '../shared/dependencies';
import { mapSubmitAnswerError } from '../shared/error-mapper';
import type { SubmitAnswerRequest, SubmitAnswerResponse } from './dto';
import { submitAnswerHandler } from './handler';
import type { StubQuestionService } from './QuestionService';
import { submitAnswerSchema } from './validation';

/**
 * Create submit answer route
 */
export function submitAnswerRoute(clock: Clock) {
  const deps = new QuizDependencyProvider();
  const questionService = deps.submitAnswerQuestionService;

  return new Hono<{
    Variables: { user: AuthUser } & LoggerVariables & TransactionVariables;
  }>().post('/:sessionId/submit-answer', zValidator('json', submitAnswerSchema), (c) => {
    const route = createAmbientRoute<
      SubmitAnswerRequest,
      SubmitAnswerResponse,
      {
        quizRepo: IQuizRepository;
        questionService: StubQuestionService;
        clock: Clock;
      },
      { user: AuthUser } & LoggerVariables & TransactionVariables
    >(
      {
        operation: 'submit',
        resource: 'answer',
        requiresAuth: true,
        extractLogContext: (body, c) => {
          const request = body as SubmitAnswerRequest;
          const user = c?.get('user') as AuthUser;
          const sessionId = c?.req.param('sessionId');

          return {
            userId: user?.sub,
            sessionId,
            questionId: request.questionId,
            optionCount: request.selectedOptionIds.length,
          };
        },
        extractSuccessLogData: (result, c) => {
          const response = result as SubmitAnswerResponse;
          const user = c?.get('user') as AuthUser;
          const sessionId = c?.req.param('sessionId');

          return {
            userId: user?.sub,
            sessionId,
            submittedAt: response.submittedAt,
            state: response.state,
            autoCompleted: response.autoCompleted,
            questionsAnswered: response.questionsAnswered,
          };
        },
        errorMapper: mapSubmitAnswerError,
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
        const request = body as SubmitAnswerRequest;
        const user = context.get('user') as AuthUser;
        const sessionId = context.req.param('sessionId');

        // Validate session ID
        if (!sessionId || !isValidUUID(sessionId)) {
          return Result.fail(new ValidationError('Invalid session ID format. Expected UUID.'));
        }

        const userIdVO = UserId.of(user.sub);
        const sessionIdVO = QuizSessionId.of(sessionId);

        return submitAnswerHandler(
          request,
          sessionIdVO,
          userIdVO,
          routeDeps.quizRepo,
          routeDeps.questionService,
          routeDeps.clock
        );
      }
    );

    // Inject dependencies
    return route(c, {
      quizRepo: getRepository(c, QUIZ_REPO_TOKEN),
      questionService: questionService,
      clock: clock,
    });
  });
}
