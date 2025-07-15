/**
 * App Factory Pattern
 * @fileoverview Creates Hono app with dependency injection for different environments
 */

import { Hono } from 'hono';
import pkg from '../package.json';
import type { IUserRepository } from './features/auth/domain/repositories/IUserRepository';
// Route modules that will use injected dependencies
import { createAuthRoutes } from './features/auth/routes-factory';
// Dependencies interfaces
import type { IAuthProvider } from './infra/auth/AuthProvider';
import type { Logger } from './infra/logger';
import type { TransactionContext } from './infra/unit-of-work';
import {
  createLoggerMiddleware,
  errorHandler,
  type LoggerVariables,
  type RequestIdVariables,
  requestIdMiddleware,
  securityMiddleware,
} from './middleware';
import { createHealthRoute } from './system/health/route';

/**
 * Dependencies required to build the application
 */
export interface AppDependencies {
  // Cross-cutting concerns
  logger: Logger;
  clock: () => Date;

  // Health & infrastructure
  ping: () => Promise<void>;

  // Domain services
  userRepository: IUserRepository;
  authProvider: IAuthProvider;
}

/**
 * Helper to wrap repository with automatic transaction handling
 * Reduces boilerplate for repositories that need transactions
 */
function withTx<T extends object>(
  repoFactory: (trx: TransactionContext) => T,
  withTransaction: <R>(fn: (trx: TransactionContext) => Promise<R>) => Promise<R>
): T {
  // Proxy intercepts any function call on repo interface
  return new Proxy({} as T, {
    get(_target, prop: string | symbol) {
      return async (...args: unknown[]) =>
        withTransaction(async (trx) => {
          const repo = repoFactory(trx);
          const method = repo[prop as keyof T];
          if (typeof method === 'function') {
            return method.apply(repo, args);
          }
          throw new Error(`Property ${String(prop)} is not a function`);
        });
    },
  });
}

/**
 * App factory function
 * Creates Hono app with injected dependencies for clean architecture
 */
export function buildApp(deps: AppDependencies): Hono<{
  Variables: LoggerVariables & RequestIdVariables;
}> {
  // Create app with proper type for context variables
  const app = new Hono<{
    Variables: LoggerVariables & RequestIdVariables;
  }>();

  // Global middleware (order matters!)
  app.use('*', requestIdMiddleware());
  app.use('*', createLoggerMiddleware(deps.logger));
  app.use('*', securityMiddleware());

  // Mount routes with injected dependencies
  app.route('/health', createHealthRoute({ ping: deps.ping, clock: deps.clock }));
  app.route('/api/auth', createAuthRoutes(deps.userRepository, deps.authProvider));

  // TODO: Add more routes as features are implemented
  // app.route('/api/quiz', createQuizRoutes(deps.quizRepository));

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
    Variables: LoggerVariables & RequestIdVariables;
  }>
> {
  // Import production dependencies
  const { createAuthProvider } = await import('./infra/auth/AuthProviderFactory');
  const { DrizzleUserRepository } = await import(
    './features/auth/domain/repositories/DrizzleUserRepository'
  );
  const { withTransaction } = await import('./infra/unit-of-work');
  const { ping } = await import('./infra/db/client');
  const { getRootLogger } = await import('./infra/logger/root-logger');
  const { createDomainLogger } = await import('./infra/logger/PinoLoggerAdapter');

  // Create production dependencies
  const logger = getRootLogger();
  const authProvider = createAuthProvider();
  const userRepositoryLogger = createDomainLogger('auth.repository.user');

  // Use withTx helper to reduce boilerplate
  const userRepository = withTx(
    (trx) => new DrizzleUserRepository(trx, userRepositoryLogger),
    withTransaction
  );

  return buildApp({
    logger,
    clock: () => new Date(),
    ping,
    userRepository,
    authProvider,
  });
}
