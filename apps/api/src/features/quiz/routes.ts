/**
 * Quiz routes factory
 * @fileoverview Composition of all quiz-related HTTP routes
 */

import type { AuthUser } from '@api/middleware/auth/auth-user';
import { Hono } from 'hono';
import { createGetResultsRoute } from './get-results/route';
import { createStartQuizRoute } from './start-quiz/route';
import { createSubmitAnswerRoute } from './submit-answer/route';

/**
 * Create quiz routes with all endpoints
 */
export function createQuizRoutes(): Hono<{ Variables: { user: AuthUser } }> {
  const app = new Hono<{ Variables: { user: AuthUser } }>();

  // Quiz management routes
  const startQuizRoute = createStartQuizRoute();
  const submitAnswerRoute = createSubmitAnswerRoute();
  const getResultsRoute = createGetResultsRoute();

  // Mount routes with proper path structure
  // POST /quiz/:id/start - Start a new quiz session
  app.route('/quiz', startQuizRoute);

  // POST /quiz/:sessionId/submit-answer - Submit an answer to a question
  app.route('/quiz', submitAnswerRoute);

  // GET /quiz/:sessionId/results - Get quiz results
  app.route('/quiz', getResultsRoute);

  return app;
}
