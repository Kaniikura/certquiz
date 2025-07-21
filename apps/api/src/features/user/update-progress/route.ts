/**
 * Update progress route implementation
 * @fileoverview HTTP endpoint for updating user progress after quiz completion
 */

import type { LoggerVariables } from '@api/middleware/logger';
import type { Clock } from '@api/shared/clock';
import { type Context, Hono } from 'hono';
import type { IUserRepository } from '../domain/repositories/IUserRepository';
import { UserNotFoundError, updateProgressHandler } from './handler';

// Helper function to safely parse JSON
async function safeJson(c: Context): Promise<unknown> {
  try {
    return await c.req.json();
  } catch (_error) {
    return null;
  }
}

// Error mapper for update progress errors
function mapUpdateProgressError(error: Error): { status: number; body: object } {
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

  if (error instanceof UserNotFoundError) {
    return {
      status: 404,
      body: {
        success: false,
        error: {
          code: 'USER_NOT_FOUND',
          message: error.message,
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
type UpdateProgressVariables = {
  userRepository: IUserRepository;
  clock: Clock;
} & LoggerVariables;

export const updateProgressRoute = new Hono<{
  Variables: UpdateProgressVariables;
}>().put('/progress', async (c) => {
  const logger = c.get('logger');

  try {
    // Get request body
    const body = await safeJson(c);

    // Log progress update attempt
    const userId =
      body && typeof body === 'object' && 'userId' in body
        ? (body as { userId?: unknown }).userId
        : undefined;
    const category =
      body && typeof body === 'object' && 'category' in body
        ? (body as { category?: unknown }).category
        : undefined;

    logger.info('Progress update attempt', { userId, category });

    // Get dependencies from DI container/context
    const userRepo = c.get('userRepository');
    const clock = c.get('clock');

    // Delegate to handler
    const result = await updateProgressHandler(body, userRepo, clock);

    if (!result.success) {
      const error = result.error;

      // Log progress update failure
      logger.warn('Progress update failed', {
        userId,
        category,
        errorType: error.name,
        errorMessage: error.message,
      });

      const { status, body: errorBody } = mapUpdateProgressError(error);
      // biome-ignore lint/suspicious/noExplicitAny: Hono requires ContentfulStatusCode casting
      return c.json(errorBody, status as any);
    }

    // Log successful progress update
    logger.info('Progress update successful', {
      userId,
      category,
      newLevel: result.data.progress.level,
      newExperience: result.data.progress.experience,
      newStreak: result.data.progress.currentStreak,
    });

    return c.json({
      success: true,
      data: result.data,
    });
  } catch (error) {
    logger.error('Progress update route error', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return c.json(
      {
        success: false,
        error: {
          code: 'REPOSITORY_ERROR',
          message: 'Internal server error',
        },
      },
      500
    );
  }
});
