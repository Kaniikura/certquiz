/**
 * App Factory Pattern
 * @fileoverview Creates Hono app with dependency injection for different environments
 */

import { Hono } from 'hono';
import pkg from '../package.json' with { type: 'json' };
import { createAdminRoutes } from './features/admin/routes-factory';
// Route modules that will use injected dependencies
import { createAuthRoutes } from './features/auth/routes-factory';
import type { IPremiumAccessService } from './features/question/domain/services/IPremiumAccessService';
import { createQuestionRoutes } from './features/question/routes-factory';
import type { IQuizCompletionService } from './features/quiz/application/QuizCompletionService';
import { createQuizRoutes } from './features/quiz/routes-factory';
import { createUserRoutes } from './features/user/routes-factory';
// Dependencies interfaces
import type { IAuthProvider } from './infra/auth/AuthProvider';
import { sql } from './infra/db/client';
import type { IDatabaseContext } from './infra/db/IDatabaseContext';
import type { DIContainer } from './infra/di/DIContainer';
import {
  AUTH_PROVIDER_TOKEN,
  CLOCK_TOKEN,
  DATABASE_CONTEXT_TOKEN,
  DATABASE_PROVIDER_TOKEN,
  ID_GENERATOR_TOKEN,
  LOGGER_TOKEN,
  PREMIUM_ACCESS_SERVICE_TOKEN,
  QUIZ_COMPLETION_SERVICE_TOKEN,
} from './infra/di/tokens';
import type { Logger } from './infra/logger/root-logger';
import { createLoggerMiddleware, type LoggerVariables } from './middleware/logger';
import { errorHandler } from './middleware/on-error';
import { type RequestIdVariables, requestIdMiddleware } from './middleware/request-id';
import { securityMiddleware } from './middleware/security';
import {
  createDatabaseContextMiddleware,
  type DatabaseContextVariables,
} from './middleware/transaction';
import type { Clock } from './shared/clock';
import type { IdGenerator } from './shared/id-generator/IdGenerator';
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

  // Application services
  quizCompletionService: IQuizCompletionService;

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
  app.route(
    '/api/quiz',
    createQuizRoutes(deps.clock, deps.databaseContext, deps.quizCompletionService)
  );

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
 * Build app using async DI container
 * This supports async service factories for complex initialization
 *
 * @param container - Configured async DI container
 * @returns Promise of Hono app instance
 */
export async function buildAppWithContainer(container: DIContainer): Promise<
  Hono<{
    Variables: LoggerVariables & RequestIdVariables & DatabaseContextVariables;
  }>
> {
  // Resolve dependencies from async container
  const [
    logger,
    clock,
    authProvider,
    databaseContext,
    premiumAccessService,
    idGenerator,
    quizCompletionService,
  ] = await Promise.all([
    container.resolve(LOGGER_TOKEN),
    container.resolve(CLOCK_TOKEN),
    container.resolve(AUTH_PROVIDER_TOKEN),
    container.resolve(DATABASE_CONTEXT_TOKEN),
    container.resolve(PREMIUM_ACCESS_SERVICE_TOKEN),
    container.resolve(ID_GENERATOR_TOKEN),
    container.resolve(QUIZ_COMPLETION_SERVICE_TOKEN),
  ]);

  // Note: AsyncDatabaseContext now auto-initializes by default in production/development
  // For test environment, initialization is disabled and handled manually when needed

  // Create other dependencies that aren't in the container yet
  const ping = async () => {
    // Perform a simple SELECT 1 query to verify database connectivity
    // This is the standard lightweight health check for PostgreSQL
    const timeoutMs = 2000; // 2 second timeout for health checks

    try {
      // Get the database provider directly from the container
      const databaseProvider = await container.resolve(DATABASE_PROVIDER_TOKEN);

      // Get a database connection from the provider
      const db = await databaseProvider.getDatabase();

      // Execute SELECT 1 query with timeout
      await Promise.race([
        // Execute the health check query directly
        db
          .execute(sql`SELECT 1 as health_check`)
          .then((result) => {
            // Verify we got the expected result
            if (!result || result.length === 0 || result[0].health_check !== 1) {
              throw new Error('Unexpected health check query result');
            }
          }),
        // Timeout promise
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Health check query timeout')), timeoutMs)
        ),
      ]);
    } catch (error) {
      // Re-throw with more context
      if (error instanceof Error) {
        if (error.message === 'Health check query timeout') {
          throw new Error('Database health check timed out after 2 seconds');
        }
        throw new Error(`Database health check failed: ${error.message}`);
      }
      throw error;
    }
  };

  // Build dependencies object
  const deps: AppDependencies = {
    logger,
    clock,
    idGenerator,
    ping,
    premiumAccessService,
    authProvider,
    quizCompletionService,
    databaseContext,
  };

  // Use existing buildApp function
  return buildApp(deps);
}
