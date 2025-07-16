/**
 * Auth Routes Factory
 * @fileoverview Creates auth routes with injected dependencies
 */

import type { IAuthProvider } from '@api/infra/auth/AuthProvider';
import { getRootLogger } from '@api/infra/logger';
import { Hono } from 'hono';
import type { IUserRepository } from './domain/repositories/IUserRepository';
import { mapAuthError } from './http/error-mapper';
import { safeJson } from './http/request-helpers';
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
  const logger = getRootLogger().child({ module: 'auth.routes' });

  // All auth routes are public (login, register, etc.)
  // Protected user profile routes would go in a separate user feature

  /**
   * POST /login - User authentication
   */
  authRoutes.post('/login', async (c) => {
    try {
      const body = await safeJson(c);
      const result = await loginHandler(body, userRepository, authProvider);

      if (!result.success) {
        const { status, body: errorBody } = mapAuthError(result.error);
        return c.json(errorBody, status);
      }

      return c.json({
        success: true,
        data: result.data,
      });
    } catch (error) {
      logger.error('Login route error', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
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
