/**
 * Submit answer HTTP route
 * @fileoverview HTTP endpoint for submitting answers to quiz questions using route utilities
 */

import { UserId } from '@api/features/auth/domain/value-objects/UserId';
import { getRepositoryFromContext } from '@api/infra/repositories/providers';
import type { AuthUser } from '@api/middleware/auth/auth-user';
import type { LoggerVariables } from '@api/middleware/logger';
import type { DatabaseContextVariables } from '@api/middleware/transaction';
import type { Clock } from '@api/shared/clock';
import { ValidationError } from '@api/shared/errors';
import type { LoggerPort } from '@api/shared/logger/LoggerPort';
import { Result } from '@api/shared/result';
import { createAmbientRoute } from '@api/shared/route/route-builder';
import { QUIZ_REPO_TOKEN } from '@api/shared/types/RepositoryToken';
import { isValidUUID } from '@api/shared/validation/constants';
import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import type { IQuizCompletionService } from '../application/QuizCompletionService';
import type { IQuizRepository } from '../domain/repositories/IQuizRepository';
import { QuizSessionId } from '../domain/value-objects/Ids';
import { QuizDependencyProvider } from '../shared/dependencies';
import { mapSubmitAnswerError } from '../shared/error-mapper';
import type { SubmitAnswerRequest, SubmitAnswerResponse } from './dto';
import { submitAnswerHandler } from './handler';
import type { StubQuestionService } from './QuestionService';
import { submitAnswerSchema } from './validation';

/**
 * Create submit answer route
 */
export function submitAnswerRoute(clock: Clock, quizCompletionService: IQuizCompletionService) {
  const deps = new QuizDependencyProvider();
  const questionService = deps.submitAnswerQuestionService;

  return new Hono<{
    Variables: { user: AuthUser } & LoggerVariables & DatabaseContextVariables;
  }>().post('/:sessionId/submit-answer', zValidator('json', submitAnswerSchema), (c) => {
    const route = createAmbientRoute<
      SubmitAnswerRequest,
      SubmitAnswerResponse,
      {
        quizRepo: IQuizRepository;
        questionService: StubQuestionService;
        quizCompletionService: IQuizCompletionService;
        clock: Clock;
      },
      { user: AuthUser } & LoggerVariables & DatabaseContextVariables
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
          const response = result as SubmitAnswerResponse & {
            _metadata?: { completionError?: { message: string; code?: string } };
          };
          const user = c?.get('user') as AuthUser;
          const sessionId = c?.req.param('sessionId');
          const logger = c?.get('logger') as LoggerPort;

          // Log completion errors if they occurred
          if (response._metadata?.completionError && logger) {
            logger.warn('Quiz completion service failed during auto-completion', {
              userId: user?.sub,
              sessionId,
              error: response._metadata.completionError.message,
              errorCode: response._metadata.completionError.code,
              operation: 'quiz_auto_completion',
            });
          }

          return {
            userId: user?.sub,
            sessionId,
            submittedAt: response.submittedAt,
            state: response.state,
            autoCompleted: response.autoCompleted,
            questionsAnswered: response.questionsAnswered,
            completionErrorOccurred: !!response._metadata?.completionError,
          };
        },
        errorMapper: mapSubmitAnswerError,
      },
      async (
        body,
        routeDeps: {
          quizRepo: IQuizRepository;
          questionService: StubQuestionService;
          quizCompletionService: IQuizCompletionService;
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
          routeDeps.quizCompletionService,
          routeDeps.clock
        );
      }
    );

    // Inject dependencies
    return route(c, {
      quizRepo: getRepositoryFromContext(c, QUIZ_REPO_TOKEN),
      questionService: questionService,
      quizCompletionService: quizCompletionService,
      clock: clock,
    });
  });
}
