/**
 * Auth Routes Factory
 * @fileoverview Creates auth routes with injected dependencies
 */

import type { IAuthProvider } from '@api/infra/auth/AuthProvider';
import type { IDatabaseContext } from '@api/infra/db/IDatabaseContext';
import { getRepositoryFromContext } from '@api/infra/repositories/providers';
import type { LoggerVariables } from '@api/middleware/logger';
import type { DatabaseContextVariables } from '@api/middleware/transaction';
import { createStandardRoute } from '@api/shared/route/routeConfigHelpers';
import { AUTH_USER_REPO_TOKEN } from '@api/shared/types/RepositoryToken';
import { Hono } from 'hono';
import type { IAuthUserRepository } from './domain/repositories/IAuthUserRepository';
import { loginHandler } from './login/handler';
import { mapAuthError } from './shared/error-mapper';

/**
 * Create login route with injected dependencies
 * Follows standard pattern used throughout the codebase
 */
function loginRoute(authProvider: IAuthProvider): ReturnType<typeof createStandardRoute> {
  return createStandardRoute<
    unknown,
    { token: string; user: { id: string; email: string; role: string } },
    { authUserRepo: IAuthUserRepository; authProvider: IAuthProvider }
  >({
    method: 'post',
    path: '/login',
    configOptions: {
      operation: 'login',
      resource: 'auth',
      requiresAuth: false,
      errorMapper: mapAuthError,
    },
    handler: async (body, deps, _context) => {
      return loginHandler(body, deps.authUserRepo, deps.authProvider);
    },
    getDependencies: (c) => ({
      authUserRepo: getRepositoryFromContext(c, AUTH_USER_REPO_TOKEN),
      authProvider: authProvider,
    }),
  });
}

/**
 * Create auth routes with dependency injection
 * This factory allows us to inject different implementations for different environments
 */
export function createAuthRoutes(
  authProvider: IAuthProvider,
  _databaseContext: IDatabaseContext
): Hono<{
  Variables: LoggerVariables & DatabaseContextVariables;
}> {
  const authRoutes = new Hono<{ Variables: LoggerVariables & DatabaseContextVariables }>();

  // All auth routes are public (login, register, etc.)
  // Protected user profile routes would go in a separate user feature

  // Mount login route using standard pattern
  authRoutes.route('/', loginRoute(authProvider));

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
