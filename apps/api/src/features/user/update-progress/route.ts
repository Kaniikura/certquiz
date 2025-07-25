/**
 * Update progress route implementation
 * @fileoverview HTTP endpoint for updating user progress after quiz completion using route utilities
 */

import { getUserRepository } from '@api/infra/repositories/providers';
import type { LoggerVariables } from '@api/middleware/logger';
import type { TransactionVariables } from '@api/middleware/transaction';
import type { Clock } from '@api/shared/clock';
import { createAmbientRoute } from '@api/shared/route';
import { Hono } from 'hono';
import type { IUserRepository } from '../domain/repositories/IUserRepository';
import { mapUserError } from '../shared/error-mapper';
import { updateProgressHandler } from './handler';

/**
 * Create update progress route with injected dependencies
 */
export function updateProgressRoute(clock: Clock) {
  return new Hono<{ Variables: LoggerVariables & TransactionVariables }>().put('/progress', (c) => {
    const route = createAmbientRoute<
      unknown,
      { progress: { level: number; experience: number; currentStreak: number } },
      { userRepo: IUserRepository; clock: Clock },
      LoggerVariables & TransactionVariables
    >(
      {
        operation: 'update',
        resource: 'progress',
        requiresAuth: true,
        extractLogContext: (body) => {
          const userId =
            body && typeof body === 'object' && 'userId' in body
              ? (body as { userId?: unknown }).userId
              : undefined;
          const category =
            body && typeof body === 'object' && 'category' in body
              ? (body as { category?: unknown }).category
              : undefined;
          return { userId, category };
        },
        extractSuccessLogData: (result) => {
          const data = result as {
            progress: { level: number; experience: number; currentStreak: number };
          };
          return {
            newLevel: data.progress.level,
            newExperience: data.progress.experience,
            newStreak: data.progress.currentStreak,
          };
        },
        errorMapper: mapUserError,
      },
      async (body, deps: { userRepo: IUserRepository; clock: Clock }, _context) => {
        return updateProgressHandler(body, deps.userRepo, deps.clock);
      }
    );

    // Inject dependencies
    return route(c, {
      userRepo: getUserRepository(c),
      clock: clock,
    });
  });
}
