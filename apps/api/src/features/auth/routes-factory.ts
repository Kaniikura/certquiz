/**
 * Auth Routes Factory
 * @fileoverview Creates auth routes with injected dependencies
 */

import type { IAuthProvider } from '@api/infra/auth/AuthProvider';
import { Hono } from 'hono';
import type { IUserRepository } from './domain/repositories/IUserRepository';
import { loginHandler } from './login/handler';

/**
 * Create auth routes with dependency injection
 * This factory allows us to inject different implementations for different environments
 */
export function createAuthRoutes(
  userRepository: IUserRepository,
  authProvider: IAuthProvider
): Hono {
  const authRoutes = new Hono();

  /**
   * POST /login - User authentication
   */
  authRoutes.post('/login', async (c) => {
    try {
      // Get request body
      const body = await c.req.json().catch(() => null);

      // Delegate to handler with injected dependencies
      const result = await loginHandler(body, userRepository, authProvider);

      if (!result.success) {
        // Map domain errors to appropriate HTTP status codes
        const error = result.error;

        if (error.name === 'ValidationError') {
          return c.json({ error: error.message }, 400);
        }

        if (error.name === 'UserNotFoundError' || error.name === 'InvalidCredentialsError') {
          return c.json({ error: 'Invalid credentials' }, 401);
        }

        if (error.name === 'UserNotActiveError') {
          return c.json({ error: 'Account is not active' }, 403);
        }

        // Generic error
        return c.json({ error: 'Authentication failed' }, 500);
      }

      return c.json({
        success: true,
        data: result.data,
      });
    } catch (error) {
      // biome-ignore lint/suspicious/noConsole: TODO: replace with logger or Logging Middleware
      console.error('Login route error:', error);
      return c.json({ error: 'Internal server error' }, 500);
    }
  });

  // TODO: Add future auth routes
  // authRoutes.post('/refresh', createRefreshHandler(userRepository, authProvider));
  // authRoutes.post('/logout', createLogoutHandler(userRepository, authProvider));

  /**
   * Health check for auth service
   * Useful for service monitoring and debugging
   */
  authRoutes.get('/health', (c) => {
    return c.json({
      service: 'auth',
      status: 'healthy',
      timestamp: new Date().toISOString(),
    });
  });

  return authRoutes;
}
