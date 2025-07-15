/**
 * Login route implementation
 * @fileoverview HTTP endpoint for user authentication
 */

import type { IAuthProvider } from '@api/infra/auth/AuthProvider';
import type { LoggerVariables } from '@api/middleware/logger';
import { Hono } from 'hono';
import type { IUserRepository } from '../domain/repositories/IUserRepository';
import { loginHandler } from './handler';

// Define context variables for this route
type LoginVariables = {
  userRepository: IUserRepository;
  authProvider: IAuthProvider;
} & LoggerVariables;

export const loginRoute = new Hono<{
  Variables: LoginVariables;
}>().post('/login', async (c) => {
  const logger = c.get('logger');

  try {
    // Get request body
    const body = await c.req.json().catch(() => null);

    // Log login attempt (without password)
    const email = body?.email;
    logger.info('Login attempt', { email });

    // Get dependencies from DI container/context
    const userRepo = c.get('userRepository');
    const authProvider = c.get('authProvider');

    // Delegate to handler
    const result = await loginHandler(body, userRepo, authProvider);

    if (!result.success) {
      // Map domain errors to appropriate HTTP status codes
      const error = result.error;

      // Log authentication failure
      logger.warn('Login failed', {
        email,
        errorType: error.name,
        errorMessage: error.message,
      });

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

    // Log successful login
    logger.info('Login successful', {
      userId: result.data.user.id,
      email: result.data.user.email,
      role: result.data.user.role,
    });

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
