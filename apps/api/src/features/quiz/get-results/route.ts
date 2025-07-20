/**
 * Get results HTTP route
 * @fileoverview HTTP endpoint for retrieving quiz results and scoring
 */

import { createDomainLogger } from '@api/infra/logger/PinoLoggerAdapter';
import { withTransaction } from '@api/infra/unit-of-work';
import type { AuthUser } from '@api/middleware/auth/auth-user';
import { Hono } from 'hono';
import { DrizzleQuizRepository } from '../domain/repositories/DrizzleQuizRepository';
import type { IQuizRepository } from '../domain/repositories/IQuizRepository';
import { QuizSessionId, UserId } from '../domain/value-objects/Ids';
import { createSuccessResponse, handleRouteError } from '../shared/route-utils';
import { getResultsHandler } from './handler';
import type { IQuestionDetailsService } from './QuestionDetailsService';
import { StubQuestionDetailsService } from './QuestionDetailsService';

/**
 * Create get results route with dependency injection
 */
export function createGetResultsRoute(): Hono<{ Variables: { user: AuthUser } }> {
  const route = new Hono<{ Variables: { user: AuthUser } }>();
  const logger = createDomainLogger('quiz.get-results');
  const questionDetailsService: IQuestionDetailsService = new StubQuestionDetailsService(); // TODO: Replace with real implementation

  /**
   * GET /:sessionId/results - Get quiz results and scoring
   * Requires authentication
   */
  route.get('/:sessionId/results', async (c) => {
    const user = c.get('user');
    const sessionIdParam = c.req.param('sessionId');
    const context = {
      userId: user.sub,
      sessionId: sessionIdParam,
    };

    try {
      logger.info('Getting quiz results', context);

      // Execute handler within transaction
      const result = await executeGetResults(
        sessionIdParam,
        user.sub,
        questionDetailsService,
        logger
      );

      if (!result.success) {
        return handleRouteError(c, result.error, logger, context);
      }

      const response = result.data;
      logger.info('Quiz results retrieved successfully', {
        ...context,
        state: response.state,
        questionsAnswered: response.answers.length,
        percentage: response.score.percentage,
        canViewResults: response.canViewResults,
      });

      return c.json(createSuccessResponse(response));
    } catch (error) {
      logger.error('Get results route error', {
        ...context,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      return c.json({ error: 'Internal server error' }, 500);
    }
  });

  return route;
}

/**
 * Execute get results handler with transaction
 * Extracted to reduce complexity
 */
async function executeGetResults(
  sessionIdParam: string,
  userSub: string,
  questionDetailsService: IQuestionDetailsService,
  logger: ReturnType<typeof createDomainLogger>
) {
  return withTransaction(async (trx) => {
    const quizRepository: IQuizRepository = new DrizzleQuizRepository(trx, logger);
    const userId = UserId.of(userSub);
    const sessionId = QuizSessionId.of(sessionIdParam);

    return getResultsHandler({}, sessionId, userId, quizRepository, questionDetailsService);
  });
}
