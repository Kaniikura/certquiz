/**
 * Question routes composition
 * @fileoverview Aggregates all question-related routes with dependency injection
 */

import { createDomainLogger } from '@api/infra/logger/PinoLoggerAdapter';
import { type TransactionContext, withTransaction } from '@api/infra/unit-of-work';
import { auth } from '@api/middleware/auth';
import type { AuthUser } from '@api/middleware/auth/auth-user';
import type { Clock } from '@api/shared/clock';
import { SystemClock } from '@api/shared/clock';
import { Hono } from 'hono';
import { createQuestionRoute } from './create-question/route';
import { DrizzleQuestionRepository } from './domain/repositories/DrizzleQuestionRepository';
import type { IQuestionRepository } from './domain/repositories/IQuestionRepository';
import { getQuestionRoute } from './get-question/route';
import { listQuestionsRoute } from './list-questions/route';

/**
 * Paths that should be excluded from transaction middleware
 * These endpoints don't require database access and should respond quickly
 */
const TRANSACTION_EXCLUDED_PATHS = new Set(['/health']);

// Define context variables for question routes
type QuestionVariables = {
  questionRepository: IQuestionRepository;
  clock: Clock;
  user?: AuthUser; // Optional as public endpoints exist for non-premium questions
};

/**
 * Question routes with dependency injection middleware
 * Provides transaction-scoped repositories to all question endpoints
 */
export const questionRoutes = new Hono<{
  Variables: QuestionVariables;
}>();

// Create logger for question repository
const questionRepositoryLogger = createDomainLogger('question.repository');

// Create clock instance (singleton for request lifecycle)
const clock = new SystemClock();

/**
 * Health check for question service (public endpoint)
 * Useful for service monitoring and debugging
 * Note: This is outside transaction middleware to avoid unnecessary DB connections
 */
questionRoutes.get('/health', (c) => {
  return c.json({
    service: 'question',
    status: 'healthy',
    timestamp: new Date().toISOString(),
  });
});

/**
 * Dependency injection middleware
 * Creates transaction-scoped repository instances for each request
 * Applied only to routes that need database access
 */
questionRoutes.use('*', async (c, next) => {
  // Skip transaction for excluded paths
  if (TRANSACTION_EXCLUDED_PATHS.has(c.req.path)) {
    return next();
  }

  // Use withTransaction to ensure all question operations are transactional
  await withTransaction(async (trx: TransactionContext) => {
    // Create repository instance with transaction and logger
    const questionRepository = new DrizzleQuestionRepository(trx, questionRepositoryLogger);

    // Inject dependencies into context
    c.set('questionRepository', questionRepository);
    c.set('clock', clock);

    // Continue to route handlers
    await next();
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
publicRoutes.route('/', listQuestionsRoute);
publicRoutes.route('/', getQuestionRoute);

// Mount protected routes (authentication required, admin role)
protectedRoutes.route('/', createQuestionRoute);

// Mount both groups to questionRoutes
questionRoutes.route('/', publicRoutes);
questionRoutes.route('/', protectedRoutes);
