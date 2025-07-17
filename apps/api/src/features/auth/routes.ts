/**
 * Auth routes composition
 * @fileoverview Aggregates all auth-related routes with dependency injection
 */

import type { IAuthProvider } from '@api/infra/auth/AuthProvider';
import { createAuthProvider } from '@api/infra/auth/AuthProviderFactory';
import { createDomainLogger } from '@api/infra/logger/PinoLoggerAdapter';
import { type TransactionContext, withTransaction, withUnitOfWork } from '@api/infra/unit-of-work';
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

// Create logger for user repository
const userRepositoryLogger = createDomainLogger('auth.repository.user');

/**
 * Dependency injection middleware
 * Creates transaction-scoped repository instances for each request
 * 
 * Note: This demonstrates both the legacy and new Unit of Work patterns.
 * New handlers should prefer the withUnitOfWork pattern for better repository coordination.
 */
authRoutes.use('*', async (c, next) => {
  // Enhanced Unit of Work pattern (recommended for new code)
  await withUnitOfWork(async (uow) => {
    // Repositories are automatically available through UnitOfWork
    // All operations share the same transaction context
    c.set('userRepository', uow.users);
    c.set('authProvider', authProvider);

    // Continue to route handlers
    await next();
  }, userRepositoryLogger);

  /* Legacy pattern (kept for reference):
  await withTransaction(async (trx: TransactionContext) => {
    // Manual repository instantiation required
    const userRepository = new DrizzleUserRepository(trx, userRepositoryLogger);
    
    c.set('userRepository', userRepository);
    c.set('authProvider', authProvider);
    await next();
  });
  */
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
