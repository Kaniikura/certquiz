/**
 * Register route implementation
 * @fileoverview HTTP endpoint for user registration using route utilities
 */

import { getRepositoryFromContext } from '@api/infra/repositories/providers';
import type { Clock } from '@api/shared/clock';
import { createStandardRoute } from '@api/shared/route/routeConfigHelpers';
import { USER_REPO_TOKEN } from '@api/shared/types/RepositoryToken';
import type { IUserRepository } from '../domain/repositories/IUserRepository';
import { mapUserError } from '../shared/error-mapper';
import type { RegisterResponse } from './dto';
import { registerHandler } from './handler';

/**
 * Create register route with injected dependencies
 */
export function registerRoute(clock: Clock): ReturnType<typeof createStandardRoute> {
  return createStandardRoute<
    unknown,
    RegisterResponse,
    { userRepo: IUserRepository; clock: Clock }
  >({
    method: 'post',
    path: '/register',
    configOptions: {
      operation: 'register',
      resource: 'user',
      requiresAuth: false,
      successStatusCode: 201,
      logging: {
        extractLogContext: (body) => {
          // Extract safe log data from request body
          const data = body as Record<string, unknown>;
          return {
            email: data?.email,
            username: data?.username,
          };
        },
        extractSuccessLogData: (result) => {
          const data = result as RegisterResponse;
          return {
            userId: data.user.id,
            email: data.user.email,
            username: data.user.username,
            role: data.user.role,
          };
        },
      },
      errorMapper: mapUserError,
    },
    handler: async (body, deps, _context) => {
      return registerHandler(body, deps.userRepo, deps.clock);
    },
    getDependencies: (c) => ({
      userRepo: getRepositoryFromContext(c, USER_REPO_TOKEN),
      clock: clock,
    }),
  });
}
