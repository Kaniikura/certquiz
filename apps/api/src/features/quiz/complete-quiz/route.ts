/**
 * Complete quiz route definition
 * @fileoverview Route configuration for quiz completion endpoint
 */

import { UserId } from '@api/features/auth/domain/value-objects/UserId';
import type { AuthUser } from '@api/middleware/auth/auth-user';
import type { Clock } from '@api/shared/clock';
import { createStandardRoute } from '@api/shared/route/routeConfigHelpers';
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
): ReturnType<typeof createStandardRoute> {
  return createStandardRoute<
    never, // No body required
    CompleteQuizResponse,
    {
      quizCompletionService: IQuizCompletionService;
      clock: Clock;
    }
  >({
    method: 'post',
    path: '/:sessionId/complete',
    configOptions: {
      operation: 'complete',
      resource: 'quiz',
      requiresAuth: true,
      successStatusCode: 200,
      errorMapper: mapCompleteQuizError,
    },
    handler: async (_body, deps, context) => {
      const sessionId = QuizSessionId.of(context.req.param('sessionId'));
      const user = context.get('user') as AuthUser;
      const userId = UserId.of(user.sub);

      return completeQuizHandler(sessionId, userId, deps.quizCompletionService, deps.clock);
    },
    getDependencies: (_c) => ({
      quizCompletionService: quizCompletionService,
      clock: clock,
    }),
  });
}
