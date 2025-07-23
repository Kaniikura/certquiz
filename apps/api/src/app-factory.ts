/**
 * App Factory Pattern
 * @fileoverview Creates Hono app with dependency injection for different environments
 */

import { Hono } from 'hono';
import pkg from '../package.json';
import { createAdminRoutes } from './features/admin/routes-factory';
import type { IUserRepository } from './features/auth/domain/repositories/IUserRepository';
// Route modules that will use injected dependencies
import { createAuthRoutes } from './features/auth/routes-factory';
import type { IQuestionRepository } from './features/question/domain/repositories/IQuestionRepository';
import type { IPremiumAccessService } from './features/question/domain/services/IPremiumAccessService';
import { createQuestionRoutes } from './features/question/routes-factory';
import type { IQuizRepository } from './features/quiz/domain/repositories/IQuizRepository';
import { createQuizRoutes } from './features/quiz/routes-factory';
import { createUserRoutes } from './features/user/routes-factory';
// Dependencies interfaces
import type { IAuthProvider } from './infra/auth/AuthProvider';
import type { Logger } from './infra/logger';
import { createUnitOfWorkFactory } from './infra/unit-of-work-provider';
import {
  createLoggerMiddleware,
  createSelectiveUnitOfWorkMiddleware,
  errorHandler,
  type LoggerVariables,
  type RequestIdVariables,
  requestIdMiddleware,
  securityMiddleware,
  type UnitOfWorkVariables,
} from './middleware';
import type { IdGenerator } from './shared/id-generator';
import type { TxRunner } from './shared/tx-runner';
import { createHealthRoute } from './system/health/route';

/**
 * Dependencies required to build the application
 */
export interface AppDependencies {
  // Cross-cutting concerns
  logger: Logger;
  clock: () => Date;
  idGenerator: IdGenerator;

  // Health & infrastructure
  ping: () => Promise<void>;

  // Domain services
  premiumAccessService: IPremiumAccessService;
  authProvider: IAuthProvider;

  // Deprecated - these will be removed after migration
  userRepository?: IUserRepository;
  quizRepository?: IQuizRepository;
  questionRepository?: IQuestionRepository;
  txRunner?: TxRunner;
}

/**
 * App factory function
 * Creates Hono app with injected dependencies for clean architecture
 */
export function buildApp(deps: AppDependencies): Hono<{
  Variables: LoggerVariables & RequestIdVariables & UnitOfWorkVariables;
}> {
  // Create app with proper type for context variables
  const app = new Hono<{
    Variables: LoggerVariables & RequestIdVariables & UnitOfWorkVariables;
  }>();

  // Global middleware (order matters!)
  app.use('*', requestIdMiddleware());
  app.use('*', createLoggerMiddleware(deps.logger));
  app.use('*', securityMiddleware());

  // Add UnitOfWork middleware for all routes except health
  const excludedPaths = new Set(['/health']);
  app.use(
    '*',
    createSelectiveUnitOfWorkMiddleware(
      createUnitOfWorkFactory({ useFake: process.env.NODE_ENV === 'test' }),
      excludedPaths
    )
  );

  // Mount routes with injected dependencies
  app.route('/health', createHealthRoute({ ping: deps.ping, clock: deps.clock }));

  // Public auth routes (login, register, etc.)
  app.route('/api/auth', createAuthRoutes(deps.authProvider));

  // Question routes (public questions + protected admin creation)
  app.route(
    '/api/questions',
    createQuestionRoutes(deps.premiumAccessService, { now: deps.clock }, deps.idGenerator)
  );

  // Quiz routes (public + protected sections)
  app.route('/api/quiz', createQuizRoutes());

  // User routes (public + protected sections)
  app.route('/api/users', createUserRoutes());

  // Admin routes (all protected with admin role)
  app.route('/api/admin', createAdminRoutes());

  // Root route
  app.get('/', (c) => {
    return c.json({
      message: 'CertQuiz API - VSA Architecture',
      status: 'ready',
      version: pkg.version,
    });
  });

  // Install error handler (must be after all routes)
  app.onError(errorHandler);

  // 404 handler for unmatched routes - must be last!
  app.all('*', (c) => {
    return c.json(
      {
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: `Route ${c.req.method} ${c.req.path} not found`,
        },
      },
      404
    );
  });

  return app;
}

/**
 * Production app builder
 * Uses real dependencies from environment
 */
export async function buildProductionApp(): Promise<
  Hono<{
    Variables: LoggerVariables & RequestIdVariables & UnitOfWorkVariables;
  }>
> {
  // Import production dependencies
  const { createAuthProvider } = await import('./infra/auth/AuthProviderFactory.prod');
  const { ping } = await import('./infra/db/client');
  const { getRootLogger } = await import('./infra/logger/root-logger');
  const { CryptoIdGenerator } = await import('./shared/id-generator');
  const { PremiumAccessService } = await import(
    './features/question/domain/services/PremiumAccessService'
  );
  const { SystemClock } = await import('./shared/clock');

  // Create production dependencies
  const logger = getRootLogger();
  const authProvider = createAuthProvider();
  const idGenerator = new CryptoIdGenerator();
  const premiumAccessService = new PremiumAccessService();
  const clock = new SystemClock();
  // Note: Repositories are now created by UnitOfWork, not injected
  // The withTx helper and repository imports are no longer needed

  return buildApp({
    logger,
    clock: () => clock.now(),
    idGenerator,
    ping,
    premiumAccessService,
    authProvider,
  });
}
