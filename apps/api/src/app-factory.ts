/**
 * App Factory Pattern
 * @fileoverview Creates Hono app with dependency injection for different environments
 */

import { Hono } from 'hono';
import pkg from '../package.json';
import { createAdminRoutes } from './features/admin/routes-factory';
import type { IAuthUserRepository } from './features/auth/domain/repositories/IAuthUserRepository';
// Route modules that will use injected dependencies
import { createAuthRoutes } from './features/auth/routes-factory';
import type { IPremiumAccessService } from './features/question/domain';
import { createQuestionRoutes } from './features/question/routes-factory';
import { createQuizRoutes } from './features/quiz/routes-factory';
import { createUserRoutes } from './features/user/routes-factory';
// Dependencies interfaces
import type { IAuthProvider } from './infra/auth/AuthProvider';
import { sql } from './infra/db';
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
import { AUTH_USER_REPO_TOKEN } from './shared/types/RepositoryToken';
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
  const [logger, clock, authProvider, databaseContext, premiumAccessService, idGenerator] =
    await Promise.all([
      container.resolve(LOGGER_TOKEN),
      container.resolve(CLOCK_TOKEN),
      container.resolve(AUTH_PROVIDER_TOKEN),
      container.resolve(DATABASE_CONTEXT_TOKEN),
      container.resolve(PREMIUM_ACCESS_SERVICE_TOKEN),
      container.resolve(ID_GENERATOR_TOKEN),
    ]);

  // Note: AsyncDatabaseContext now auto-initializes by default in production/development
  // For test environment, initialization is disabled and handled manually when needed

  // Create other dependencies that aren't in the container yet
  const ping = async () => {
    // Perform a simple SELECT 1 query to verify database connectivity
    // This is the standard lightweight health check for PostgreSQL
    const timeoutMs = 2000; // 2 second timeout for health checks

    try {
      await Promise.race([
        databaseContext.withinTransaction(async (ctx) => {
          // The transaction context wraps the actual database connection
          // We need to access the underlying database to execute raw SQL
          const transactionCtx = ctx as {
            db?: {
              execute: (query: ReturnType<typeof sql>) => Promise<Array<{ health_check: number }>>;
            };
          };

          if (!transactionCtx.db || !transactionCtx.db.execute) {
            // Fallback: just verify we can get a repository
            const userRepo = ctx.getRepository<IAuthUserRepository>(AUTH_USER_REPO_TOKEN);
            if (!userRepo) {
              throw new Error('Failed to get repository from database context');
            }
            return; // Basic connectivity verified
          }

          // Execute SELECT 1 query - the most lightweight connectivity check
          const result = await transactionCtx.db.execute(sql`SELECT 1 as health_check`);

          // Verify we got the expected result
          if (!result || result.length === 0 || result[0].health_check !== 1) {
            throw new Error('Unexpected health check query result');
          }
        }),
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
    databaseContext,
  };

  // Use existing buildApp function
  return buildApp(deps);
}
