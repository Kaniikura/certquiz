/**
 * Question Routes Factory
 * @fileoverview Creates question routes with proper dependency injection
 */

import type { IDatabaseContext } from '@api/infra/db/IDatabaseContext';
import { auth } from '@api/middleware/auth';
import type { AuthUser } from '@api/middleware/auth/auth-user';
import type { DatabaseContextVariables } from '@api/middleware/transaction';
import type { Clock } from '@api/shared/clock';
import type { IdGenerator } from '@api/shared/id-generator';
import { Hono } from 'hono';
import { createQuestionRoute } from './create-question/route';
import type { IPremiumAccessService } from './domain/services/IPremiumAccessService';
import { getQuestionRoute } from './get-question/route';
import { listQuestionsRoute } from './list-questions/route';

// Define context variables for question routes
type QuestionVariables = {
  user?: AuthUser; // Optional as public endpoints exist for non-premium questions
} & DatabaseContextVariables;

/**
 * Create question routes with dependency injection
 * This factory allows us to inject different implementations for different environments
 */
export function createQuestionRoutes(
  premiumAccessService: IPremiumAccessService,
  clock: Clock,
  idGenerator: IdGenerator,
  _databaseContext: IDatabaseContext
): Hono<{
  Variables: QuestionVariables;
}> {
  const questionRoutes = new Hono<{
    Variables: QuestionVariables;
  }>();

  /**
   * Health check for question service (public endpoint)
   * Useful for service monitoring and debugging
   */
  questionRoutes.get('/health', (c) => {
    return c.json({
      service: 'question',
      status: 'healthy',
      timestamp: new Date().toISOString(),
    });
  });

  // Create separate groups for public and protected routes
  const publicRoutes = new Hono<{ Variables: QuestionVariables }>();
  const protectedRoutes = new Hono<{ Variables: QuestionVariables }>();

  // Apply optional authentication middleware to public routes (for premium access)
  // This allows unauthenticated users to access non-premium questions
  publicRoutes.use('*', auth({ required: false }));

  // Apply required authentication middleware to protected routes with admin role
  protectedRoutes.use('*', auth({ required: true, roles: ['admin'] }));

  // Mount public routes (authentication optional, premium content requires auth)
  publicRoutes.route('/', listQuestionsRoute(premiumAccessService));
  publicRoutes.route('/', getQuestionRoute(premiumAccessService));

  // Mount protected routes (authentication required, admin role)
  protectedRoutes.route('/', createQuestionRoute({ clock, idGenerator }));

  // Mount both groups to questionRoutes
  questionRoutes.route('/', publicRoutes);
  questionRoutes.route('/', protectedRoutes);

  return questionRoutes;
}
