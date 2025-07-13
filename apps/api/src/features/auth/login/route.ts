/**
 * Login route implementation
 * @fileoverview HTTP endpoint for user authentication
 */

import type { IAuthProvider } from '@api/infra/auth/AuthProvider';
import { Hono } from 'hono';
import type { IUserRepository } from '../domain/repositories/IUserRepository';
import { loginHandler } from './handler';

// Define context variables for this route
type LoginVariables = {
  userRepository: IUserRepository;
  authProvider: IAuthProvider;
};

export const loginRoute = new Hono<{
  Variables: LoginVariables;
}>().post('/login', async (c) => {
  try {
    // Get request body
    const body = await c.req.json().catch(() => null);

    // Get dependencies from DI container/context
    const userRepo = c.get('userRepository');
    const authProvider = c.get('authProvider');

    // Delegate to handler
    const result = await loginHandler(body, userRepo, authProvider);

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
    // biome-ignore lint/suspicious/noConsole: TODO: Inject logger service and use structured logging
    console.error('Login route error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});
