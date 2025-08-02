/**
 * Create question route implementation
 * @fileoverview HTTP endpoint for admin question creation using route utilities
 */

import { getRepositoryFromContext } from '@api/infra/repositories/providers';
import type { AuthUser } from '@api/middleware/auth/auth-user';
import type { LoggerVariables } from '@api/middleware/logger';
import type { DatabaseContextVariables } from '@api/middleware/transaction';
import type { Clock } from '@api/shared/clock';
import type { IdGenerator } from '@api/shared/id-generator/IdGenerator';
import { createAmbientRoute } from '@api/shared/route/route-builder';
import { QUESTION_REPO_TOKEN } from '@api/shared/types/RepositoryToken';
import { Hono } from 'hono';
import type { IQuestionRepository } from '../domain/repositories/IQuestionRepository';
import { mapQuestionError } from '../shared/error-mapper';
import type { CreateQuestionResponse } from './dto';
import { createQuestionHandler } from './handler';

// Define context variables for this route
type CreateQuestionVariables = {
  user: AuthUser; // Required for admin authorization
} & LoggerVariables &
  DatabaseContextVariables;

export function createQuestionRoute(deps: { clock: Clock; idGenerator: IdGenerator }) {
  return new Hono<{
    Variables: CreateQuestionVariables;
  }>().post('/', (c) => {
    const route = createAmbientRoute<
      unknown,
      CreateQuestionResponse,
      { questionRepo: IQuestionRepository; clock: Clock; idGenerator: IdGenerator },
      CreateQuestionVariables
    >(
      {
        operation: 'create',
        resource: 'question',
        requiresAuth: true,
        successStatusCode: 201,
        extractLogContext: (body) => {
          const logBody =
            typeof body === 'object' && body !== null
              ? (body as { questionType?: string; isPremium?: boolean })
              : null;
          return {
            questionType: logBody?.questionType,
            isPremium: logBody?.isPremium,
          };
        },
        extractSuccessLogData: (result) => {
          const data = result as CreateQuestionResponse;
          return {
            questionId: data.question.id,
            questionType: data.question.questionType,
            isPremium: data.question.isPremium,
            status: data.question.status,
          };
        },
        errorMapper: mapQuestionError,
      },
      async (
        body,
        routeDeps: { questionRepo: IQuestionRepository; clock: Clock; idGenerator: IdGenerator },
        context
      ) => {
        const user = context.get('user') as AuthUser;

        return createQuestionHandler(
          body,
          routeDeps.questionRepo,
          routeDeps.clock,
          routeDeps.idGenerator,
          user.sub,
          user.roles
        );
      }
    );

    // Inject dependencies
    return route(c, {
      questionRepo: getRepositoryFromContext(c, QUESTION_REPO_TOKEN),
      clock: deps.clock,
      idGenerator: deps.idGenerator,
    });
  });
}
