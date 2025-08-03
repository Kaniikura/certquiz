/**
 * Get profile route implementation
 * @fileoverview HTTP endpoint for retrieving user profile and progress using route utilities
 */

import { getRepositoryFromContext } from '@api/infra/repositories/providers';
import type { Clock } from '@api/shared/clock';
import { ValidationError } from '@api/shared/errors';
import { Result } from '@api/shared/result';
import { createStandardRoute } from '@api/shared/route/routeConfigHelpers';
import { USER_REPO_TOKEN } from '@api/shared/types/RepositoryToken';
import { isValidUUID } from '@api/shared/validation/constants';
import type { IUserRepository } from '../domain/repositories/IUserRepository';
import { mapUserError } from '../shared/error-mapper';
import type { GetProfileResponse } from './dto';
import { getProfileHandler } from './handler';

/**
 * Create get profile route
 * Clock is passed for consistency but not used in this route
 */
export function getProfileRoute(_clock: Clock) {
  return createStandardRoute<unknown, GetProfileResponse, { userRepo: IUserRepository }>({
    method: 'get',
    path: '/profile/:userId',
    configOptions: {
      operation: 'get',
      resource: 'profile',
      requiresAuth: true,
      logging: {
        extractLogContext: (_body, context) => {
          const userId = context?.req.param('userId');
          return { userId };
        },
        extractSuccessLogData: (result) => {
          const data = result as GetProfileResponse;
          return {
            userId: data.user.id,
            username: data.user.username,
            level: data.user.progress.level,
            experience: data.user.progress.experience,
          };
        },
      },
      errorMapper: mapUserError,
    },
    handler: async (_body, deps, context) => {
      // Get and validate user ID from URL parameter
      const userId = context.req.param('userId');

      if (!userId || !isValidUUID(userId)) {
        return Result.fail(new ValidationError('Invalid user ID format. Expected UUID.'));
      }

      return getProfileHandler({ userId }, deps.userRepo);
    },
    getDependencies: (c) => ({
      userRepo: getRepositoryFromContext(c, USER_REPO_TOKEN),
    }),
  });
}
