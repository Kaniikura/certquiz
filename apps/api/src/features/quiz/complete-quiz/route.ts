/**
 * Complete quiz route definition
 * @fileoverview Route configuration for quiz completion endpoint
 */

import type { AuthUser } from '@api/middleware/auth/auth-user';
import type { LoggerVariables } from '@api/middleware/logger';
import type { DatabaseContextVariables } from '@api/middleware/transaction';
import type { Clock } from '@api/shared/clock';
import { createAmbientRoute } from '@api/shared/route/route-builder';
import { Hono } from 'hono';
import { UserId } from '../../user/domain/value-objects';
import type { IQuizCompletionService } from '../application/QuizCompletionService';
import { QuizSessionId } from '../domain/value-objects/Ids';
import { mapCompleteQuizError } from '../shared/error-mapper';
import type { CompleteQuizResponse } from './dto';
import { completeQuizHandler } from './handler';

/**
 * Create complete quiz route
 * POST /:sessionId/complete - Complete a quiz and update user progress
 */
export function completeQuizRoute(
  clock: Clock,
  quizCompletionService: IQuizCompletionService
): Hono<{
  Variables: { user: AuthUser } & LoggerVariables & DatabaseContextVariables;
}> {
  return new Hono<{
    Variables: { user: AuthUser } & LoggerVariables & DatabaseContextVariables;
  }>().post('/:sessionId/complete', (c) => {
    const route = createAmbientRoute<
      never, // No body required
      CompleteQuizResponse,
      {
        quizCompletionService: IQuizCompletionService;
      },
      { user: AuthUser } & LoggerVariables & DatabaseContextVariables
    >(
      {
        operation: 'complete',
        resource: 'quiz',
        requiresAuth: true,
        successStatusCode: 200,
        errorMapper: mapCompleteQuizError,
      },
      async (_, routeDeps, context) => {
        const sessionId = QuizSessionId.of(c.req.param('sessionId'));
        const user = context.get('user') as AuthUser;
        const userId = UserId.of(user.sub);

        return completeQuizHandler(sessionId, userId, routeDeps.quizCompletionService, clock);
      }
    );

    return route(c, {
      quizCompletionService: quizCompletionService,
    });
  });
}
