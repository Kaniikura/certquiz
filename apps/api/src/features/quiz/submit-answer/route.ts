/**
 * Submit answer HTTP route
 * @fileoverview HTTP endpoint for submitting answers to quiz questions
 */

import type { AuthUser } from '@api/middleware/auth/auth-user';
import type { UnitOfWorkVariables } from '@api/middleware/unit-of-work';
import { zValidator } from '@hono/zod-validator';
import type { Hono } from 'hono';
import { QuizDependencyProvider } from '../shared/dependencies';
import { createQuizRoute } from '../shared/route-factory';
import type { SubmitAnswerRequest, SubmitAnswerResponse } from './dto';
import { submitAnswerHandler } from './handler';
import { submitAnswerSchema } from './validation';

/**
 * Create submit answer route with dependency injection
 */
export function createSubmitAnswerRoute(): Hono<{
  Variables: { user: AuthUser } & UnitOfWorkVariables;
}> {
  const deps = new QuizDependencyProvider();

  return createQuizRoute<SubmitAnswerRequest, SubmitAnswerResponse>({
    method: 'post',
    path: '/:sessionId/submit-answer',
    loggerName: 'quiz.submit-answer',
    validator: zValidator('json', submitAnswerSchema),
    services: {
      questionService: deps.submitAnswerQuestionService,
      clock: deps.clock,
    },
    getLogContext: (request, params) => ({
      sessionId: params.sessionId,
      questionId: request.questionId,
      optionCount: request.selectedOptionIds.length,
    }),
    getSuccessLogData: (response) => ({
      submittedAt: response.submittedAt,
      state: response.state,
      autoCompleted: response.autoCompleted,
      questionsAnswered: response.questionsAnswered,
    }),
    createTransactionHandler: (request, context) => {
      return async ({ quizRepository, userId, sessionId }) => {
        if (!sessionId) {
          throw new Error('Session ID is required');
        }
        return submitAnswerHandler(
          request,
          sessionId,
          userId,
          quizRepository,
          context.services.questionService as typeof deps.submitAnswerQuestionService,
          context.services.clock as typeof deps.clock
        );
      };
    },
  });
}
