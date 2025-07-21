/**
 * Register route implementation
 * @fileoverview HTTP endpoint for user registration
 */

import { type SupportedStatusCode, safeJson } from '@api/features/quiz/shared/route-utils';
import type { LoggerVariables } from '@api/middleware/logger';
import type { Clock } from '@api/shared/clock';
import { Hono } from 'hono';
import type { IUserRepository } from '../domain/repositories/IUserRepository';
import { EmailAlreadyTakenError, registerHandler, UsernameAlreadyTakenError } from './handler';

// Error mapper for registration errors
function mapRegisterError(error: Error): { status: number; body: object } {
  if (error.name === 'ValidationError') {
    return {
      status: 400,
      body: {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: error.message,
        },
      },
    };
  }

  if (error instanceof EmailAlreadyTakenError) {
    return {
      status: 409,
      body: {
        success: false,
        error: {
          code: 'EMAIL_ALREADY_TAKEN',
          message: error.message,
          field: 'email',
        },
      },
    };
  }

  if (error instanceof UsernameAlreadyTakenError) {
    return {
      status: 409,
      body: {
        success: false,
        error: {
          code: 'USERNAME_ALREADY_TAKEN',
          message: error.message,
          field: 'username',
        },
      },
    };
  }

  // Default error response
  return {
    status: 500,
    body: {
      success: false,
      error: {
        code: 'REPOSITORY_ERROR',
        message: 'Internal server error',
      },
    },
  };
}

// Define context variables for this route
type RegisterVariables = {
  userRepository: IUserRepository;
  clock: Clock;
} & LoggerVariables;

export const registerRoute = new Hono<{
  Variables: RegisterVariables;
}>().post('/register', async (c) => {
  const logger = c.get('logger');

  try {
    // Get request body
    const body = await safeJson(c);

    // Log registration attempt (without sensitive data)
    const email =
      body && typeof body === 'object' && 'email' in body
        ? (body as { email?: unknown }).email
        : undefined;
    const username =
      body && typeof body === 'object' && 'username' in body
        ? (body as { username?: unknown }).username
        : undefined;

    logger.info('Registration attempt', { email, username });

    // Get dependencies from DI container/context
    const userRepo = c.get('userRepository');
    const clock = c.get('clock');

    // Delegate to handler
    const result = await registerHandler(body, userRepo, clock);

    if (!result.success) {
      const error = result.error;

      // Log registration failure
      logger.warn('Registration failed', {
        email,
        username,
        errorType: error.name,
        errorMessage: error.message,
      });

      const { status, body: errorBody } = mapRegisterError(error);
      return c.json(errorBody, status as SupportedStatusCode);
    }

    // Log successful registration
    logger.info('Registration successful', {
      userId: result.data.user.id,
      email: result.data.user.email,
      username: result.data.user.username,
      role: result.data.user.role,
    });

    return c.json(
      {
        success: true,
        data: result.data,
      },
      201
    );
  } catch (error) {
    logger.error('Registration route error', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    const { status, body: errorBody } = mapRegisterError(
      error instanceof Error ? error : new Error('Unknown error')
    );
    return c.json(errorBody, status as SupportedStatusCode);
  }
});
