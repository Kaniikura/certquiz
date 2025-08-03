/**
 * Create question route implementation
 * @fileoverview HTTP endpoint for admin question creation using route utilities
 */

import { getRepositoryFromContext } from '@api/infra/repositories/providers';
import type { AuthUser } from '@api/middleware/auth/auth-user';
import type { Clock } from '@api/shared/clock';
import type { IdGenerator } from '@api/shared/id-generator/IdGenerator';
import { createStandardRoute } from '@api/shared/route/routeConfigHelpers';
import { QUESTION_REPO_TOKEN } from '@api/shared/types/RepositoryToken';
import type { IQuestionRepository } from '../domain/repositories/IQuestionRepository';
import { mapQuestionError } from '../shared/error-mapper';
import type { CreateQuestionResponse } from './dto';
import { createQuestionHandler } from './handler';
import type { CreateQuestionRequest } from './validation';

export function createQuestionRoute(deps: {
  clock: Clock;
  idGenerator: IdGenerator;
}): ReturnType<typeof createStandardRoute> {
  return createStandardRoute<
    CreateQuestionRequest,
    CreateQuestionResponse,
    {
      questionRepo: IQuestionRepository;
      clock: Clock;
      idGenerator: IdGenerator;
    }
  >({
    method: 'post',
    path: '/',
    configOptions: {
      operation: 'create',
      resource: 'question',
      requiresAuth: true,
      successStatusCode: 201,
      logging: {
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
      },
      errorMapper: mapQuestionError,
    },
    handler: async (body, routeDeps, context) => {
      const user = context.get('user') as AuthUser;

      return createQuestionHandler(
        body,
        routeDeps.questionRepo,
        routeDeps.clock,
        routeDeps.idGenerator,
        user.sub,
        user.roles
      );
    },
    getDependencies: (c) => ({
      questionRepo: getRepositoryFromContext(c, QUESTION_REPO_TOKEN),
      clock: deps.clock,
      idGenerator: deps.idGenerator,
    }),
  });
}
