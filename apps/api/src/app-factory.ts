/**
 * App Factory Pattern
 * @fileoverview Creates Hono app with dependency injection for different environments
 */

import { Hono } from 'hono';
import pkg from '../package.json';
import type { User } from './features/auth/domain/entities/User';
import type { IUserRepository } from './features/auth/domain/repositories/IUserRepository';
import type { Email } from './features/auth/domain/value-objects/Email';
import type { UserId } from './features/auth/domain/value-objects/UserId';
// Route modules that will use injected dependencies
import { createAuthRoutes } from './features/auth/routes-factory';
// Dependencies interfaces
import type { IAuthProvider } from './infra/auth/AuthProvider';
import {
  errorHandler,
  type LoggerVariables,
  loggerMiddleware,
  type RequestIdVariables,
  requestIdMiddleware,
  securityMiddleware,
} from './middleware';
import { healthRoute } from './system/health/route';

/**
 * Dependencies required to build the application
 */
export interface AppDependencies {
  userRepository: IUserRepository;
  authProvider: IAuthProvider;
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
  app.use('*', loggerMiddleware);
  app.use('*', securityMiddleware());

  // Mount routes with injected dependencies
  app.route('/health', healthRoute);
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

  // Create production dependencies
  const authProvider = createAuthProvider();

  // Note: We need to handle repository creation differently since it needs transaction
  // For now, we'll create a wrapper that handles transaction internally
  const userRepository: IUserRepository = {
    async findByEmail(email: Email): Promise<User | null> {
      return withTransaction(async (trx) => {
        const repo = new DrizzleUserRepository(trx);
        return repo.findByEmail(email);
      });
    },
    async findById(id: UserId): Promise<User | null> {
      return withTransaction(async (trx) => {
        const repo = new DrizzleUserRepository(trx);
        return repo.findById(id);
      });
    },
    async findByKeycloakId(keycloakId: string): Promise<User | null> {
      return withTransaction(async (trx) => {
        const repo = new DrizzleUserRepository(trx);
        return repo.findByKeycloakId(keycloakId);
      });
    },
    async findByUsername(username: string): Promise<User | null> {
      return withTransaction(async (trx) => {
        const repo = new DrizzleUserRepository(trx);
        return repo.findByUsername(username);
      });
    },
    async save(user: User): Promise<void> {
      return withTransaction(async (trx) => {
        const repo = new DrizzleUserRepository(trx);
        return repo.save(user);
      });
    },
    async isEmailTaken(email: Email): Promise<boolean> {
      return withTransaction(async (trx) => {
        const repo = new DrizzleUserRepository(trx);
        return repo.isEmailTaken(email);
      });
    },
    async isUsernameTaken(username: string): Promise<boolean> {
      return withTransaction(async (trx) => {
        const repo = new DrizzleUserRepository(trx);
        return repo.isUsernameTaken(username);
      });
    },
  };

  return buildApp({
    userRepository,
    authProvider,
  });
}
