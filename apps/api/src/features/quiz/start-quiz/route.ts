/**
 * Start quiz HTTP route
 * @fileoverview HTTP endpoint for creating new quiz sessions
 */

import type { AuthUser } from '@api/middleware/auth/auth-user';
import { zValidator } from '@hono/zod-validator';
import type { Hono } from 'hono';
import { QuizDependencyProvider } from '../shared/dependencies';
import { createQuizRoute } from '../shared/route-factory';
import type { StartQuizRequest, StartQuizResponse } from './dto';
import { startQuizHandler } from './handler';
import { startQuizSchema } from './validation';

/**
 * Create start quiz route with dependency injection
 */
export function createStartQuizRoute(): Hono<{ Variables: { user: AuthUser } }> {
  const deps = new QuizDependencyProvider();

  return createQuizRoute<StartQuizRequest, StartQuizResponse>({
    method: 'post',
    path: '/:id/start',
    loggerName: 'quiz.start-quiz',
    validator: zValidator('json', startQuizSchema),
    services: {
      questionService: deps.startQuizQuestionService,
      clock: deps.clock,
    },
    getLogContext: (request, params) => ({
      quizId: params.id,
      examType: request.examType,
      questionCount: request.questionCount,
    }),
    getSuccessLogData: (response) => ({
      sessionId: response.sessionId,
      totalQuestions: response.totalQuestions,
      expiresAt: response.expiresAt,
    }),
    createTransactionHandler: (request, context) => {
      return async ({ quizRepository, userId }) => {
        return startQuizHandler(
          request,
          userId,
          quizRepository,
          context.services.questionService as typeof deps.startQuizQuestionService,
          context.services.clock as typeof deps.clock
        );
      };
    },
  });
}
