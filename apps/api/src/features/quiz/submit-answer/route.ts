/**
 * Submit answer HTTP route
 * @fileoverview HTTP endpoint for submitting answers to quiz questions
 */

import { createDomainLogger } from '@api/infra/logger/PinoLoggerAdapter';
import { withTransaction } from '@api/infra/unit-of-work';
import type { AuthUser } from '@api/middleware/auth/auth-user';
import type { Clock } from '@api/shared/clock';
import { SystemClock } from '@api/shared/clock';
import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import { DrizzleQuizRepository } from '../domain/repositories/DrizzleQuizRepository';
import type { IQuizRepository } from '../domain/repositories/IQuizRepository';
import { QuizSessionId, UserId } from '../domain/value-objects/Ids';
import { createSuccessResponse, handleRouteError } from '../shared/route-utils';
import { submitAnswerHandler } from './handler';
import type { IQuestionService } from './QuestionService';
import { StubQuestionService } from './QuestionService';
import { submitAnswerSchema } from './validation';

/**
 * Create submit answer route with dependency injection
 */
export function createSubmitAnswerRoute(): Hono<{ Variables: { user: AuthUser } }> {
  const route = new Hono<{ Variables: { user: AuthUser } }>();
  const logger = createDomainLogger('quiz.submit-answer');
  const clock: Clock = new SystemClock();
  const questionService: IQuestionService = new StubQuestionService(); // TODO: Replace with real implementation

  /**
   * POST /:sessionId/submit-answer - Submit an answer to a quiz question
   * Requires authentication
   */
  route.post('/:sessionId/submit-answer', zValidator('json', submitAnswerSchema), async (c) => {
    const user = c.get('user');
    const sessionIdParam = c.req.param('sessionId');
    const body = c.req.valid('json');
    const context = {
      userId: user.sub,
      sessionId: sessionIdParam,
      questionId: body.questionId,
    };

    try {
      logger.info('Submitting answer to quiz question', {
        ...context,
        optionCount: body.selectedOptionIds.length,
      });

      // Execute handler within transaction
      const result = await executeSubmitAnswer(
        body,
        sessionIdParam,
        user.sub,
        questionService,
        clock,
        logger
      );

      if (!result.success) {
        return handleRouteError(c, result.error, logger, context);
      }

      const response = result.data;
      logger.info('Answer submitted successfully', {
        ...context,
        submittedAt: response.submittedAt,
        state: response.state,
        autoCompleted: response.autoCompleted,
        questionsAnswered: response.questionsAnswered,
      });

      return c.json(createSuccessResponse(response));
    } catch (error) {
      logger.error('Submit answer route error', {
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
 * Execute submit answer handler with transaction
 * Extracted to reduce complexity
 */
async function executeSubmitAnswer(
  body: Parameters<typeof submitAnswerHandler>[0],
  sessionIdParam: string,
  userSub: string,
  questionService: IQuestionService,
  clock: Clock,
  logger: ReturnType<typeof createDomainLogger>
) {
  return withTransaction(async (trx) => {
    const quizRepository: IQuizRepository = new DrizzleQuizRepository(trx, logger);
    const userId = UserId.of(userSub);
    const sessionId = QuizSessionId.of(sessionIdParam);

    return submitAnswerHandler(body, sessionId, userId, quizRepository, questionService, clock);
  });
}
