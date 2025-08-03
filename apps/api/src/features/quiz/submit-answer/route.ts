/**
 * Submit answer HTTP route
 * @fileoverview HTTP endpoint for submitting answers to quiz questions using route utilities
 */

import { UserId } from '@api/features/auth/domain/value-objects/UserId';
import { getRepositoryFromContext } from '@api/infra/repositories/providers';
import type { Clock } from '@api/shared/clock';
import { ValidationError } from '@api/shared/errors';
import { validateUserContext } from '@api/shared/handler/handler-utils';
import type { LoggerPort } from '@api/shared/logger/LoggerPort';
import { Result } from '@api/shared/result';
import { createStandardRoute } from '@api/shared/route/routeConfigHelpers';
import { QUIZ_REPO_TOKEN } from '@api/shared/types/RepositoryToken';
import { isValidUUID } from '@api/shared/validation/constants';
import { zValidator } from '@hono/zod-validator';
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

  return createStandardRoute<
    SubmitAnswerRequest,
    SubmitAnswerResponse,
    {
      quizRepo: IQuizRepository;
      questionService: StubQuestionService;
      quizCompletionService: IQuizCompletionService;
      clock: Clock;
    }
  >({
    method: 'post',
    path: '/:sessionId/submit-answer',
    validator: zValidator('json', submitAnswerSchema),
    configOptions: {
      operation: 'submit',
      resource: 'answer',
      requiresAuth: true,
      logging: {
        extractLogContext: (body, c) => {
          const request = body as SubmitAnswerRequest;
          const user = c ? validateUserContext(c) : null;
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
          const user = c ? validateUserContext(c) : null;
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
      },
      errorMapper: mapSubmitAnswerError,
    },
    handler: async (body, deps, context) => {
      const request = body as SubmitAnswerRequest;
      const user = validateUserContext(context);
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
        deps.quizRepo,
        deps.questionService,
        deps.quizCompletionService,
        deps.clock
      );
    },
    getDependencies: (c) => ({
      quizRepo: getRepositoryFromContext(c, QUIZ_REPO_TOKEN),
      questionService: questionService,
      quizCompletionService: quizCompletionService,
      clock: clock,
    }),
  });
}
