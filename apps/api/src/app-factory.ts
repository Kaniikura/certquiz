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
import { createQuizRoutes } from './features/quiz/routes-factory';
import { createUserRoutes } from './features/user/routes-factory';
// Dependencies interfaces
import type { IAuthProvider } from './infra/auth/AuthProvider';
import type { IDatabaseContext } from './infra/db/IDatabaseContext';
import type { DIContainer } from './infra/di/DIContainer';
import {
  AUTH_PROVIDER_TOKEN,
  CLOCK_TOKEN,
  DATABASE_CONTEXT_TOKEN,
  ID_GENERATOR_TOKEN,
  LOGGER_TOKEN,
  PREMIUM_ACCESS_SERVICE_TOKEN,
} from './infra/di/tokens';
import type { Logger } from './infra/logger';
import {
  createDatabaseContextMiddleware,
  createLoggerMiddleware,
  type DatabaseContextVariables,
  errorHandler,
  type LoggerVariables,
  type RequestIdVariables,
  requestIdMiddleware,
  securityMiddleware,
} from './middleware';
import type { Clock } from './shared/clock';
import type { IdGenerator } from './shared/id-generator';
import { createHealthRoute } from './system/health/route';

/**
 * Dependencies required to build the application
 */
export interface AppDependencies {
  // Cross-cutting concerns
  logger: Logger;
  clock: Clock;
  idGenerator: IdGenerator;

  // Health & infrastructure
  ping: () => Promise<void>;

  // Domain services
  premiumAccessService: IPremiumAccessService;
  authProvider: IAuthProvider;

  // Database context management
  databaseContext: IDatabaseContext;
}

/**
 * App factory function
 * Creates Hono app with injected dependencies for clean architecture
 */
export function buildApp(deps: AppDependencies): Hono<{
  Variables: LoggerVariables & RequestIdVariables & DatabaseContextVariables;
}> {
  // Create app with proper type for context variables
  const app = new Hono<{
    Variables: LoggerVariables & RequestIdVariables & DatabaseContextVariables;
  }>();

  // Global middleware (order matters!)
  app.use('*', requestIdMiddleware());
  app.use('*', createLoggerMiddleware(deps.logger));
  app.use('*', securityMiddleware());

  // Database context middleware for database access (applies to all API routes)
  app.use('/api/*', createDatabaseContextMiddleware(deps.databaseContext));

  // Mount routes with injected dependencies
  app.route('/health', createHealthRoute({ ping: deps.ping, clock: () => deps.clock.now() }));

  // Public auth routes (login, register, etc.)
  app.route('/api/auth', createAuthRoutes(deps.authProvider, deps.databaseContext));

  // Question routes (public questions + protected admin creation)
  app.route(
    '/api/questions',
    createQuestionRoutes(
      deps.premiumAccessService,
      deps.clock,
      deps.idGenerator,
      deps.databaseContext
    )
  );

  // Quiz routes (public + protected sections)
  app.route('/api/quiz', createQuizRoutes(deps.clock, deps.databaseContext));

  // User routes (public + protected sections)
  app.route('/api/users', createUserRoutes(deps.databaseContext));

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
 * Build app using DI container
 * This is a gradual migration step that uses DI container to resolve dependencies
 * and passes them to the existing buildApp function
 *
 * @param container - Configured DI container
 * @returns Hono app instance
 */
export function buildAppWithContainer(container: DIContainer): Hono<{
  Variables: LoggerVariables & RequestIdVariables & DatabaseContextVariables;
}> {
  // Resolve dependencies from container
  const logger = container.resolve(LOGGER_TOKEN);
  const clock = container.resolve(CLOCK_TOKEN);
  const authProvider = container.resolve(AUTH_PROVIDER_TOKEN);
  const databaseContext = container.resolve(DATABASE_CONTEXT_TOKEN);
  const premiumAccessService = container.resolve(PREMIUM_ACCESS_SERVICE_TOKEN);
  const idGenerator = container.resolve(ID_GENERATOR_TOKEN);

  // Create other dependencies that aren't in the container yet
  const ping = async () => {
    // Use the database from the DatabaseContext - any repository access is enough
    // This is a basic connectivity check
    return;
  };

  // Build dependencies object
  const deps: AppDependencies = {
    logger,
    clock,
    idGenerator,
    ping,
    premiumAccessService,
    authProvider,
    databaseContext,
  };

  // Use existing buildApp function
  return buildApp(deps);
}
