/**
 * Get profile route implementation
 * @fileoverview HTTP endpoint for retrieving user profile and progress using route utilities
 */

import { getRepositoryFromContext } from '@api/infra/repositories/providers';
import type { LoggerVariables } from '@api/middleware/logger';
import type { DatabaseContextVariables } from '@api/middleware/transaction';
import type { Clock } from '@api/shared/clock';
import { ValidationError } from '@api/shared/errors';
import { Result } from '@api/shared/result';
import { createAmbientRoute } from '@api/shared/route';
import { USER_REPO_TOKEN } from '@api/shared/types/RepositoryToken';
import { isValidUUID } from '@api/shared/validation';
import { Hono } from 'hono';
import type { IUserRepository } from '../domain/repositories/IUserRepository';
import { mapUserError } from '../shared/error-mapper';
import type { GetProfileResponse } from './dto';
import { getProfileHandler } from './handler';

/**
 * Create get profile route
 * Clock is passed for consistency but not used in this route
 */
export function getProfileRoute(
  _clock: Clock
): Hono<{ Variables: LoggerVariables & DatabaseContextVariables }> {
  return new Hono<{ Variables: LoggerVariables & DatabaseContextVariables }>().get(
    '/profile/:userId',
    (c) => {
      const route = createAmbientRoute<
        unknown,
        GetProfileResponse,
        { userRepo: IUserRepository },
        LoggerVariables & DatabaseContextVariables
      >(
        {
          operation: 'get',
          resource: 'profile',
          requiresAuth: true,
          extractLogContext: (_body, c) => {
            const userId = c?.req.param('userId');
            return { userId };
          },
          extractSuccessLogData: (result: unknown) => {
            const data = result as GetProfileResponse;
            return {
              userId: data.user.id,
              username: data.user.username,
              level: data.user.progress.level,
              experience: data.user.progress.experience,
            };
          },
          errorMapper: mapUserError,
        },
        async (_body, deps: { userRepo: IUserRepository }, context) => {
          // Get and validate user ID from URL parameter
          const userId = context.req.param('userId');

          if (!userId || !isValidUUID(userId)) {
            return Result.fail(new ValidationError('Invalid user ID format. Expected UUID.'));
          }

          return getProfileHandler({ userId }, deps.userRepo);
        }
      );

      // Inject dependencies
      return route(c, {
        userRepo: getRepositoryFromContext(c, USER_REPO_TOKEN),
      });
    }
  );
}
