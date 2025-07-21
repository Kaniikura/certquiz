/**
 * User routes composition
 * @fileoverview Aggregates all user-related routes with dependency injection
 */

import { createDomainLogger } from '@api/infra/logger/PinoLoggerAdapter';
import { type TransactionContext, withTransaction } from '@api/infra/unit-of-work';
import { auth } from '@api/middleware/auth';
import type { AuthUser } from '@api/middleware/auth/auth-user';
import type { Clock } from '@api/shared/clock';
import { SystemClock } from '@api/shared/clock';
import { Hono } from 'hono';
import { DrizzleUserRepository } from './domain/repositories/DrizzleUserRepository';
import type { IUserRepository } from './domain/repositories/IUserRepository';
import { getProfileRoute } from './get-profile/route';
import { registerRoute } from './register/route';
import { updateProgressRoute } from './update-progress/route';

// Define context variables for user routes
type UserVariables = {
  userRepository: IUserRepository;
  clock: Clock;
  user?: AuthUser; // Optional as register route doesn't require auth
};

/**
 * User routes with dependency injection middleware
 * Provides transaction-scoped repositories to all user endpoints
 */
export const userRoutes = new Hono<{
  Variables: UserVariables;
}>();

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

/**
 * Dependency injection middleware
 * Creates transaction-scoped repository instances for each request
 * Applied only to routes that need database access
 */
userRoutes.use('*', async (c, next) => {
  // Skip transaction for health endpoint
  if (c.req.path === '/health') {
    return next();
  }

  // Use withTransaction to ensure all user operations are transactional
  await withTransaction(async (trx: TransactionContext) => {
    // Create repository instance with transaction and logger
    const userRepository = new DrizzleUserRepository(trx, userRepositoryLogger);

    // Inject dependencies into context
    c.set('userRepository', userRepository);
    c.set('clock', clock);

    // Continue to route handlers
    await next();
  });
});

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
