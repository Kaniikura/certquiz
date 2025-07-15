import type { MiddlewareHandler } from 'hono';
import type { AuthUser } from './auth/auth-user';

export interface AuthOptions {
  required?: boolean;
  roles?: string[];
}

/**
 * Authentication middleware for Hono applications.
 * Validates JWT tokens and sets authenticated user in context.
 *
 * @param options - Configuration options
 * @param options.required - Whether authentication is required (default: true)
 * @param options.roles - Required roles for authorization
 * @returns Hono middleware handler
 */
export const auth = (
  _options?: AuthOptions
): MiddlewareHandler<{
  Variables: {
    user?: AuthUser;
  };
}> => {
  return async (_c, next) => {
    // TODO: Implement authentication logic
    await next();
  };
};
