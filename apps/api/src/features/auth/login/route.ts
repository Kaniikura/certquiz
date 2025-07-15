/**
 * Login route implementation
 * @fileoverview HTTP endpoint for user authentication
 */

import type { IAuthProvider } from '@api/infra/auth/AuthProvider';
import type { LoggerVariables } from '@api/middleware/logger';
import { Hono } from 'hono';
import type { IUserRepository } from '../domain/repositories/IUserRepository';
import { mapAuthError } from '../http/error-mapper';
import { safeJson } from '../http/request-helpers';
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
    const body = await safeJson(c);

    // Log login attempt (without password)
    const email = body?.email;
    logger.info('Login attempt', { email });

    // Get dependencies from DI container/context
    const userRepo = c.get('userRepository');
    const authProvider = c.get('authProvider');

    // Delegate to handler
    const result = await loginHandler(body, userRepo, authProvider);

    if (!result.success) {
      const error = result.error;

      // Log authentication failure
      logger.warn('Login failed', {
        email,
        errorType: error.name,
        errorMessage: error.message,
      });

      const { status, body: errorBody } = mapAuthError(error);
      return c.json(errorBody, status);
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
