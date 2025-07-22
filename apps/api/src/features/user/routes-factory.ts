/**
 * User Routes Factory
 * @fileoverview Creates user routes with injected dependencies
 */

import { createDomainLogger } from '@api/infra/logger/PinoLoggerAdapter';
import { auth } from '@api/middleware/auth';
import type { AuthUser } from '@api/middleware/auth/auth-user';
import type { Clock } from '@api/shared/clock';
import { SystemClock } from '@api/shared/clock';
import type { TxRunner } from '@api/shared/tx-runner';
import { Hono } from 'hono';
import { DrizzleUserRepository } from './domain/repositories/DrizzleUserRepository';
import type { IUserRepository } from './domain/repositories/IUserRepository';
import { getProfileRoute } from './get-profile/route';
import { registerRoute } from './register/route';
import { updateProgressRoute } from './update-progress/route';

/**
 * Paths that should be excluded from transaction middleware
 * These endpoints don't require database access and should respond quickly
 */
const TRANSACTION_EXCLUDED_PATHS = new Set(['/health']);

// Define context variables for user routes
type UserVariables = {
  userRepository: IUserRepository;
  clock: Clock;
  user?: AuthUser; // Optional as register route doesn't require auth
};

/**
 * Create user routes with dependency injection
 * This factory allows us to inject different implementations for different environments
 */
export function createUserRoutes(
  userRepository: IUserRepository,
  txRunner?: TxRunner
): Hono<{ Variables: UserVariables }> {
  const userRoutes = new Hono<{ Variables: UserVariables }>();

  // Create clock instance (singleton for request lifecycle)
  const clock = new SystemClock();

  // Create logger for user repository
  const userRepositoryLogger = createDomainLogger('user.repository');

  /**
   * Health check for user service (public endpoint)
   * Useful for service monitoring and debugging
   * Note: This is outside transaction middleware to avoid unnecessary DB connections
   */
  userRoutes.get('/health', (c) => {
    return c.json({
      service: 'user',
      status: 'healthy',
      timestamp: new Date().toISOString(),
    });
  });

  // If txRunner is provided, use it for transaction handling
  if (txRunner) {
    /**
     * Dependency injection middleware
     * Creates transaction-scoped repository instances for each request
     * Applied only to routes that need database access
     */
    userRoutes.use('*', async (c, next) => {
      // Skip transaction for excluded paths
      if (TRANSACTION_EXCLUDED_PATHS.has(c.req.path)) {
        return next();
      }

      // Use txRunner to ensure all user operations are transactional
      await txRunner.run(async (trx) => {
        // Create repository instance with transaction and logger
        const transactionalUserRepository = new DrizzleUserRepository(trx, userRepositoryLogger);

        // Inject dependencies into context
        c.set('userRepository', transactionalUserRepository);
        c.set('clock', clock);

        // Continue to route handlers
        await next();
      });
    });
  } else {
    // No txRunner provided, use the userRepository directly
    userRoutes.use('*', async (c, next) => {
      c.set('userRepository', userRepository);
      c.set('clock', clock);
      await next();
    });
  }

  // Create separate groups for public and protected routes
  const publicRoutes = new Hono<{ Variables: UserVariables }>();
  const protectedRoutes = new Hono<{ Variables: UserVariables }>();

  // Apply authentication middleware to protected routes only
  protectedRoutes.use('*', auth({ required: true }));

  // Mount public routes (no authentication required)
  publicRoutes.route('/', registerRoute);

  // Mount protected routes (authentication required)
  protectedRoutes.route('/', updateProgressRoute);
  protectedRoutes.route('/', getProfileRoute);

  // Mount both groups to userRoutes
  userRoutes.route('/', publicRoutes);
  userRoutes.route('/', protectedRoutes);

  return userRoutes;
}
