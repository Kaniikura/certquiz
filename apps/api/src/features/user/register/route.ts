/**
 * Register route implementation
 * @fileoverview HTTP endpoint for user registration using route utilities
 */

import { getRepository } from '@api/infra/repositories/providers';
import type { LoggerVariables } from '@api/middleware/logger';
import type { TransactionVariables } from '@api/middleware/transaction';
import type { Clock } from '@api/shared/clock';
import { createAmbientRoute } from '@api/shared/route';
import { USER_REPO_TOKEN } from '@api/shared/types/RepositoryToken';
import { Hono } from 'hono';
import type { IUserRepository } from '../domain/repositories/IUserRepository';
import { mapUserError } from '../shared/error-mapper';
import type { RegisterResponse } from './dto';
import { registerHandler } from './handler';

/**
 * Create register route with injected dependencies
 */
export function registerRoute(clock: Clock) {
  return new Hono<{ Variables: LoggerVariables & TransactionVariables }>().post(
    '/register',
    (c) => {
      const route = createAmbientRoute<
        unknown,
        RegisterResponse,
        { userRepo: IUserRepository; clock: Clock },
        LoggerVariables & TransactionVariables
      >(
        {
          operation: 'register',
          resource: 'user',
          successStatusCode: 201,
          extractLogContext: (body) => {
            // Extract safe log data from request body
            const data = body as Record<string, unknown>;
            return {
              email: data?.email,
              username: data?.username,
            };
          },
          extractSuccessLogData: (result: unknown) => {
            const data = result as RegisterResponse;
            return {
              userId: data.user.id,
              email: data.user.email,
              username: data.user.username,
              role: data.user.role,
            };
          },
          errorMapper: mapUserError,
        },
        async (body, deps: { userRepo: IUserRepository; clock: Clock }, _context) => {
          return registerHandler(body, deps.userRepo, deps.clock);
        }
      );

      // Inject dependencies
      return route(c, {
        userRepo: getRepository(c, USER_REPO_TOKEN),
        clock: clock,
      });
    }
  );
}
