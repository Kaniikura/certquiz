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
import type { IUserRepository as IUserDomainRepository } from './features/user/domain/repositories/IUserRepository';
import { createUserRoutes } from './features/user/routes-factory';
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
  userRepository: IUserRepository;
  userDomainRepository: IUserDomainRepository;
  quizRepository: IQuizRepository;
  questionRepository: IQuestionRepository;
  premiumAccessService: IPremiumAccessService;
  authProvider: IAuthProvider;

  // Transaction handling (optional for testing)
  txRunner?: TxRunner;
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

  // Public auth routes (login, register, etc.)
  app.route('/api/auth', createAuthRoutes(deps.userRepository, deps.authProvider));

  // Question routes (public questions + protected admin creation)
  app.route(
    '/api/questions',
    createQuestionRoutes(
      deps.premiumAccessService,
      { now: deps.clock },
      deps.idGenerator,
      deps.txRunner
    )
  );

  // Quiz routes (public + protected sections)
  app.route('/api/quiz', createQuizRoutes(deps.quizRepository));

  // User routes (public + protected sections)
  app.route('/api/users', createUserRoutes(deps.userDomainRepository, deps.txRunner));

  // Admin routes (all protected with admin role)
  app.route(
    '/api/admin',
    createAdminRoutes({
      userRepository: deps.userRepository,
      quizRepository: deps.quizRepository,
    })
  );

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
  const { createAuthProvider } = await import('./infra/auth/AuthProviderFactory.prod');
  const { DrizzleUserRepository: DrizzleAuthUserRepository } = await import(
    './features/auth/domain/repositories/DrizzleUserRepository'
  );
  const { DrizzleUserRepository: DrizzleUserDomainRepository } = await import(
    './features/user/domain/repositories/DrizzleUserRepository'
  );
  const { DrizzleQuestionRepository } = await import(
    './features/question/domain/repositories/DrizzleQuestionRepository'
  );
  const { DrizzleQuizRepository } = await import(
    './features/quiz/domain/repositories/DrizzleQuizRepository'
  );
  const { withTransaction } = await import('./infra/unit-of-work');
  const { ping } = await import('./infra/db/client');
  const { getRootLogger } = await import('./infra/logger/root-logger');
  const { createDomainLogger } = await import('./infra/logger/PinoLoggerAdapter');
  const { CryptoIdGenerator } = await import('./shared/id-generator');
  const { PremiumAccessService } = await import(
    './features/question/domain/services/PremiumAccessService'
  );
  const { SystemClock } = await import('./shared/clock');
  const { DrizzleTxRunner } = await import('./shared/tx-runner');

  // Create production dependencies
  const logger = getRootLogger();
  const authProvider = createAuthProvider();
  const idGenerator = new CryptoIdGenerator();
  const premiumAccessService = new PremiumAccessService();
  const clock = new SystemClock();
  const authUserRepositoryLogger = createDomainLogger('auth.repository.user');
  const userDomainRepositoryLogger = createDomainLogger('user.repository');
  const questionRepositoryLogger = createDomainLogger('question.repository');
  const quizRepositoryLogger = createDomainLogger('quiz.repository');
  const txRunner = new DrizzleTxRunner(withTransaction);

  // Use withTx helper to reduce boilerplate
  const userRepository = withTx(
    (trx) => new DrizzleAuthUserRepository(trx, authUserRepositoryLogger),
    withTransaction
  );

  const userDomainRepository = withTx(
    (trx) => new DrizzleUserDomainRepository(trx, userDomainRepositoryLogger),
    withTransaction
  );

  const questionRepository = withTx(
    (trx) => new DrizzleQuestionRepository(trx, questionRepositoryLogger),
    withTransaction
  );

  const quizRepository = withTx(
    (trx) => new DrizzleQuizRepository(trx, quizRepositoryLogger),
    withTransaction
  );

  return buildApp({
    logger,
    clock: () => clock.now(),
    idGenerator,
    ping,
    userRepository,
    userDomainRepository,
    questionRepository,
    quizRepository,
    premiumAccessService,
    authProvider,
    txRunner,
  });
}
