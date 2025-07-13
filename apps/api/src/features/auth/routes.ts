/**
 * Auth routes composition
 * @fileoverview Aggregates all auth-related routes with dependency injection
 */

import type { IAuthProvider } from '@api/infra/auth/AuthProvider';
import { createAuthProvider } from '@api/infra/auth/AuthProviderFactory';
import { type TransactionContext, withTransaction } from '@api/infra/unit-of-work';
import { Hono } from 'hono';
import { DrizzleUserRepository } from './domain/repositories/DrizzleUserRepository';
import type { IUserRepository } from './domain/repositories/IUserRepository';
import { loginRoute } from './login/route';

// Define context variables for auth routes
type AuthVariables = {
  userRepository: IUserRepository;
  authProvider: IAuthProvider;
};

/**
 * Auth routes with dependency injection middleware
 * Provides transaction-scoped repositories to all auth endpoints
 */
export const authRoutes = new Hono<{
  Variables: AuthVariables;
}>();

// Create auth provider instance (singleton for request lifecycle)
const authProvider = createAuthProvider();

/**
 * Dependency injection middleware
 * Creates transaction-scoped repository instances for each request
 */
authRoutes.use('*', async (c, next) => {
  // Use withTransaction to ensure all auth operations are transactional
  await withTransaction(async (trx: TransactionContext) => {
    // Create repository instance with transaction
    const userRepository = new DrizzleUserRepository(trx);

    // Inject dependencies into context
    c.set('userRepository', userRepository);
    c.set('authProvider', authProvider);

    // Continue to route handlers
    await next();
  });
});

// Mount individual auth routes
authRoutes.route('/', loginRoute);

// TODO: Add future auth routes
// authRoutes.route('/', refreshRoute);
// authRoutes.route('/', logoutRoute);
// authRoutes.route('/', registerRoute);

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
