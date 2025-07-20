/**
 * Start quiz HTTP route
 * @fileoverview HTTP endpoint for creating new quiz sessions
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
import { UserId } from '../domain/value-objects/Ids';
import { createSuccessResponse, handleRouteError } from '../shared/route-utils';
import { startQuizHandler } from './handler';
import type { IQuestionService } from './QuestionService';
import { StubQuestionService } from './QuestionService';
import { startQuizSchema } from './validation';

/**
 * Create start quiz route with dependency injection
 */
export function createStartQuizRoute(): Hono<{ Variables: { user: AuthUser } }> {
  const route = new Hono<{ Variables: { user: AuthUser } }>();
  const logger = createDomainLogger('quiz.start-quiz');
  const clock: Clock = new SystemClock();
  const questionService: IQuestionService = new StubQuestionService(); // TODO: Replace with real implementation

  /**
   * POST /:id/start - Start a new quiz session
   * Requires authentication
   */
  route.post('/:id/start', zValidator('json', startQuizSchema), async (c) => {
    const user = c.get('user');
    const quizId = c.req.param('id'); // This is actually the quiz configuration, not session ID
    const body = c.req.valid('json');
    const context = {
      userId: user.sub,
      quizId,
      examType: body.examType,
      questionCount: body.questionCount,
    };

    try {
      logger.info('Starting quiz session', context);

      // Execute handler within transaction
      const result = await executeStartQuiz(body, user.sub, questionService, clock, logger);

      if (!result.success) {
        return handleRouteError(c, result.error, logger, context);
      }

      const response = result.data;
      logger.info('Quiz session started successfully', {
        ...context,
        sessionId: response.sessionId,
        totalQuestions: response.totalQuestions,
        expiresAt: response.expiresAt,
      });

      return c.json(createSuccessResponse(response));
    } catch (error) {
      logger.error('Quiz start route error', {
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
 * Execute start quiz handler with transaction
 * Extracted to reduce complexity
 */
async function executeStartQuiz(
  body: Parameters<typeof startQuizHandler>[0],
  userSub: string,
  questionService: IQuestionService,
  clock: Clock,
  logger: ReturnType<typeof createDomainLogger>
) {
  return withTransaction(async (trx) => {
    const quizRepository: IQuizRepository = new DrizzleQuizRepository(trx, logger);
    const userId = UserId.of(userSub);

    return startQuizHandler(body, userId, quizRepository, questionService, clock);
  });
}
