/**
 * User routes composition
 * @fileoverview Aggregates all user-related routes with dependency injection
 */

import { createDomainLogger } from '@api/infra/logger/PinoLoggerAdapter';
import { type TransactionContext, withTransaction } from '@api/infra/unit-of-work';
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
 * Dependency injection middleware
 * Creates transaction-scoped repository instances for each request
 */
userRoutes.use('*', async (c, next) => {
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

// Mount individual user routes
userRoutes.route('/', registerRoute);
userRoutes.route('/', updateProgressRoute);
userRoutes.route('/', getProfileRoute);

/**
 * Health check for user service
 * Useful for service monitoring and debugging
 */
userRoutes.get('/health', (c) => {
  return c.json({
    service: 'user',
    status: 'healthy',
    timestamp: new Date().toISOString(),
  });
});
