/**
 * Auth Routes Factory
 * @fileoverview Creates auth routes with injected dependencies
 */

import type { IAuthProvider } from '@api/infra/auth/AuthProvider';
import type { IUnitOfWorkProvider } from '@api/infra/db/IUnitOfWorkProvider';
import { getRootLogger } from '@api/infra/logger';
import { getAuthUserRepository } from '@api/infra/repositories/providers';
import type { LoggerVariables } from '@api/middleware/logger';
import type { TransactionVariables } from '@api/middleware/transaction';
import { createAmbientRoute } from '@api/shared/route';
import { Hono } from 'hono';
import type { IUserRepository } from './domain/repositories/IUserRepository';
import { loginHandler } from './login/handler';
import { mapAuthError } from './shared/error-mapper';

/**
 * Create auth routes with dependency injection
 * This factory allows us to inject different implementations for different environments
 */
export function createAuthRoutes(
  authProvider: IAuthProvider,
  _unitOfWorkProvider: IUnitOfWorkProvider
): Hono<{
  Variables: LoggerVariables & TransactionVariables;
}> {
  const authRoutes = new Hono<{ Variables: LoggerVariables & TransactionVariables }>();
  const _logger = getRootLogger().child({ module: 'auth.routes' });

  // All auth routes are public (login, register, etc.)
  // Protected user profile routes would go in a separate user feature

  /**
   * POST /login - User authentication
   */
  authRoutes.post('/login', (c) => {
    const route = createAmbientRoute<
      unknown,
      { token: string; user: { id: string; email: string; role: string } },
      { authUserRepo: IUserRepository; authProvider: IAuthProvider },
      LoggerVariables & TransactionVariables
    >(
      {
        operation: 'login',
        resource: 'auth',
        requiresAuth: false,
        errorMapper: mapAuthError,
      },
      async (
        body,
        deps: { authUserRepo: IUserRepository; authProvider: IAuthProvider },
        _context
      ) => {
        return loginHandler(body, deps.authUserRepo, deps.authProvider);
      }
    );

    // Inject dependencies
    return route(c, {
      authUserRepo: getAuthUserRepository(c),
      authProvider: authProvider,
    });
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
