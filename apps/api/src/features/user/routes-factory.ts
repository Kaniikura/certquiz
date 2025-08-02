/**
 * User Routes Factory
 * @fileoverview Creates user routes with injected dependencies
 */

import type { IDatabaseContext } from '@api/infra/db/IDatabaseContext';
import { auth } from '@api/middleware/auth';
import type { DatabaseContextVariables } from '@api/middleware/transaction';
import { SystemClock } from '@api/shared/clock';
import { Hono } from 'hono';
import { getProfileRoute } from './get-profile/route';
import { registerRoute } from './register/route';

/**
 * Create user routes with dependency injection
 * This factory allows us to inject different implementations for different environments
 */
export function createUserRoutes(_databaseContext: IDatabaseContext): Hono<{
  Variables: DatabaseContextVariables;
}> {
  const userRoutes = new Hono<{ Variables: DatabaseContextVariables }>();

  // Create clock instance (singleton for all requests)
  const clock = new SystemClock();

  /**
   * Health check for user service (public endpoint)
   * Useful for service monitoring and debugging
   */
  userRoutes.get('/health', (c) => {
    return c.json({
      service: 'user',
      status: 'healthy',
      timestamp: clock.now().toISOString(),
    });
  });

  // Create separate groups for public and protected routes
  const publicRoutes = new Hono<{ Variables: DatabaseContextVariables }>();
  const protectedRoutes = new Hono<{ Variables: DatabaseContextVariables }>();

  // Apply authentication middleware to protected routes only
  protectedRoutes.use('*', auth({ required: true }));

  // Mount public routes (no authentication required)
  publicRoutes.route('/', registerRoute(clock));

  // Mount protected routes (authentication required)
  protectedRoutes.route('/', getProfileRoute(clock));

  // Mount both groups to userRoutes
  userRoutes.route('/', publicRoutes);
  userRoutes.route('/', protectedRoutes);

  return userRoutes;
}
