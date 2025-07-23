/**
 * User Routes Factory
 * @fileoverview Creates user routes with injected dependencies
 */

import { auth } from '@api/middleware/auth';
import type { AuthUser } from '@api/middleware/auth/auth-user';
import type { UnitOfWorkVariables } from '@api/middleware/unit-of-work';
import type { Clock } from '@api/shared/clock';
import { SystemClock } from '@api/shared/clock';
import { Hono } from 'hono';
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
} & UnitOfWorkVariables;

/**
 * Create user routes with dependency injection
 * This factory allows us to inject different implementations for different environments
 */
export function createUserRoutes(): Hono<{ Variables: UserVariables }> {
  const userRoutes = new Hono<{ Variables: UserVariables }>();

  // Create clock instance (singleton for request lifecycle)
  const clock = new SystemClock();

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
   * Gets repository from UnitOfWork which is provided by global middleware
   */
  userRoutes.use('*', async (c, next) => {
    // Skip transaction for excluded paths
    const requestPath = c.req.path;

    // Check if the path should be excluded from transactions
    if (TRANSACTION_EXCLUDED_PATHS.has(requestPath)) {
      return next();
    }

    // Get UnitOfWork from context (provided by global middleware)
    const unitOfWork = c.get('unitOfWork');
    const userRepository = unitOfWork.getUserRepository();

    // Inject dependencies into context
    c.set('userRepository', userRepository);
    c.set('clock', clock);

    // Continue to route handlers
    await next();
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

  return userRoutes;
}
