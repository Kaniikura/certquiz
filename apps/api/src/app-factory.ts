/**
 * App Factory Pattern
 * @fileoverview Creates Hono app with dependency injection for different environments
 */

import { Hono } from 'hono';
import pkg from '../package.json';
import { createAdminRoutes } from './features/admin/routes-factory';
// Route modules that will use injected dependencies
import { createAuthRoutes } from './features/auth/routes-factory';
import type { IPremiumAccessService } from './features/question/domain';
import { createQuestionRoutes } from './features/question/routes-factory';
import { createQuizRoutes } from './features/quiz/routes';
import { createUserRoutes } from './features/user/routes-factory';
// Dependencies interfaces
import type { IAuthProvider } from './infra/auth/AuthProvider';
import type { IUnitOfWorkProvider } from './infra/db/IUnitOfWorkProvider';
import type { Logger } from './infra/logger';
import {
  createLoggerMiddleware,
  createTransactionMiddleware,
  errorHandler,
  type LoggerVariables,
  type RequestIdVariables,
  requestIdMiddleware,
  securityMiddleware,
  type TransactionVariables,
} from './middleware';
import type { IdGenerator } from './shared/id-generator';
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

  // Transaction management
  unitOfWorkProvider: IUnitOfWorkProvider;
}

/**
 * App factory function
 * Creates Hono app with injected dependencies for clean architecture
 */
export function buildApp(deps: AppDependencies): Hono<{
  Variables: LoggerVariables & RequestIdVariables & TransactionVariables;
}> {
  // Create app with proper type for context variables
  const app = new Hono<{
    Variables: LoggerVariables & RequestIdVariables & TransactionVariables;
  }>();

  // Global middleware (order matters!)
  app.use('*', requestIdMiddleware());
  app.use('*', createLoggerMiddleware(deps.logger));
  app.use('*', securityMiddleware());

  // Transaction middleware for ambient UoW pattern (applies to all API routes)
  app.use('/api/*', createTransactionMiddleware(deps.unitOfWorkProvider));

  // Mount routes with injected dependencies
  app.route('/health', createHealthRoute({ ping: deps.ping, clock: deps.clock }));

  // Public auth routes (login, register, etc.)
  app.route('/api/auth', createAuthRoutes(deps.authProvider, deps.unitOfWorkProvider));

  // Question routes (public questions + protected admin creation)
  app.route(
    '/api/questions',
    createQuestionRoutes(
      deps.premiumAccessService,
      { now: deps.clock },
      deps.idGenerator,
      deps.unitOfWorkProvider
    )
  );

  // Quiz routes (public + protected sections)
  app.route('/api/quiz', createQuizRoutes({ now: deps.clock }, deps.unitOfWorkProvider));

  // User routes (public + protected sections)
  app.route('/api/users', createUserRoutes(deps.unitOfWorkProvider));

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
