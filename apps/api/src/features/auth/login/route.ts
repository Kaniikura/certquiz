/**
 * Login route implementation
 * @fileoverview HTTP endpoint for user authentication
 */

import { Hono } from 'hono';
import type { IUserRepository } from '../domain/repositories/IUserRepository';
import { loginHandler } from './handler';

// Define context variables for this route
type LoginVariables = {
  userRepository: IUserRepository;
};

// KeyCloak client (stub for now - will be implemented in infrastructure)
const keyCloakClient = {
  authenticate: async (_email: string, password: string) => {
    // TODO: Implement actual KeyCloak integration
    // For now, simple stub that accepts any non-empty password
    if (password.length > 0) {
      return { success: true, data: { token: 'mock-jwt-token' } };
    }
    return { success: false, data: { token: '' }, error: 'Invalid credentials' };
  },
};

export const loginRoute = new Hono<{
  Variables: LoginVariables;
}>().post('/login', async (c) => {
  try {
    // Get request body
    const body = await c.req.json().catch(() => null);

    // Get repository instance from DI container/context
    const userRepo = c.get('userRepository');

    // Delegate to handler
    const result = await loginHandler(body, userRepo, keyCloakClient);

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
  } catch (_error) {
    return c.json({ error: 'Internal server error' }, 500);
  }
});
