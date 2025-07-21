/**
 * Get profile route implementation
 * @fileoverview HTTP endpoint for retrieving user profile and progress
 */

import type { SupportedStatusCode } from '@api/features/quiz/shared/route-utils';
import type { LoggerVariables } from '@api/middleware/logger';
import { Hono } from 'hono';
import type { IUserRepository } from '../domain/repositories/IUserRepository';
import { mapUserError } from '../shared/error-mapper';
import { getProfileHandler } from './handler';

// Define context variables for this route
type GetProfileVariables = {
  userRepository: IUserRepository;
} & LoggerVariables;

export const getProfileRoute = new Hono<{
  Variables: GetProfileVariables;
}>().get('/profile/:userId', async (c) => {
  const logger = c.get('logger');

  try {
    // Get user ID from URL parameter
    const userId = c.req.param('userId');

    logger.info('Get profile attempt', { userId });

    // Get dependencies from DI container/context
    const userRepo = c.get('userRepository');

    // Delegate to handler
    const result = await getProfileHandler({ userId }, userRepo);

    if (!result.success) {
      const error = result.error;

      // Log profile retrieval failure
      logger.warn('Get profile failed', {
        userId,
        errorType: error.name,
        errorMessage: error.message,
      });

      const { status, body: errorBody } = mapUserError(error);
      return c.json(errorBody, status as SupportedStatusCode);
    }

    // Log successful profile retrieval
    logger.info('Get profile successful', {
      userId,
      username: result.data.user.username,
      level: result.data.user.progress.level,
      experience: result.data.user.progress.experience,
    });

    return c.json({
      success: true,
      data: result.data,
    });
  } catch (error) {
    logger.error('Get profile route error', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    const { status, body: errorBody } = mapUserError(
      error instanceof Error ? error : new Error('Unknown error')
    );
    return c.json(errorBody, status as SupportedStatusCode);
  }
});
