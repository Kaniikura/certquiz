/**
 * Quiz routes factory
 * @fileoverview Composition of all quiz-related HTTP routes
 */

import type { IDatabaseContext } from '@api/infra/db/IDatabaseContext';
import { auth } from '@api/middleware/auth';
import type { DatabaseContextVariables } from '@api/middleware/transaction';
import type { Clock } from '@api/shared/clock';
import { Hono } from 'hono';
import type { IQuizCompletionService } from './application/QuizCompletionService';
import { completeQuizRoute } from './complete-quiz/route';
import { getResultsRoute } from './get-results/route';
import { startQuizRoute } from './start-quiz/route';
import { submitAnswerRoute } from './submit-answer/route';

/**
 * Create quiz routes with all endpoints
 */
export function createQuizRoutes(
  clock: Clock,
  _databaseContext: IDatabaseContext,
  quizCompletionService: IQuizCompletionService
): Hono<{
  Variables: DatabaseContextVariables;
}> {
  const app = new Hono<{ Variables: DatabaseContextVariables }>();

  // Health check endpoint (no database access)
  app.get('/health', (c) => {
    return c.json({
      service: 'quiz',
      status: 'healthy',
      timestamp: clock.now().toISOString(),
    });
  });

  // GET /quiz - Quiz catalog (not yet implemented)
  app.get('/', (c) => {
    return c.json(
      {
        error: 'Public quiz catalog not yet implemented',
        code: 'NOT_IMPLEMENTED',
        message: 'Question catalog implementation is planned for future releases',
      },
      501
    );
  });

  // POST /quiz - Create quiz (protected)
  app.post('/', auth(), (c) => {
    const user = c.get('user');
    return c.json(
      {
        success: true,
        data: {
          id: 'mock-quiz-id',
          title: 'Mock Quiz',
          status: 'created',
          createdBy: user?.sub || 'unknown',
        },
      },
      200
    );
  });

  // Quiz management routes
  const startQuiz = startQuizRoute(clock);
  const submitAnswer = submitAnswerRoute(clock, quizCompletionService);
  const getResults = getResultsRoute(clock);
  const completeQuiz = completeQuizRoute(clock, quizCompletionService);

  // Mount routes with proper path structure (protected routes)
  // POST /start - Start a new quiz session (protected)
  app.route('/', startQuiz);

  // POST /:sessionId/submit-answer - Submit an answer to a question
  app.route('/', submitAnswer);

  // POST /:sessionId/complete - Complete a quiz and update user progress
  app.route('/', completeQuiz);

  // GET /:sessionId/results - Get quiz results
  app.route('/', getResults);

  // Premium routes (protected with premium role) - must come before :id route
  app.get('/premium', auth({ roles: ['premium', 'admin'] }), (c) => {
    return c.json(
      {
        success: true,
        data: {
          premiumFeatures: ['feature1', 'feature2'],
          status: 'active',
        },
      },
      200
    );
  });

  // GET /quiz/:id - Quiz preview (not yet implemented)
  // This catch-all route must come after more specific routes
  app.get('/:id', (c) => {
    const id = c.req.param('id');
    return c.json(
      {
        error: 'Quiz preview not yet implemented',
        code: 'NOT_IMPLEMENTED',
        message: `Preview for quiz ${id} requires Question catalog implementation`,
      },
      501
    );
  });

  return app;
}
