/**
 * Get question route implementation
 * @fileoverview HTTP endpoint for retrieving detailed question information
 */

import { getRepositoryFromContext } from '@api/infra/repositories/providers';
import type { AuthUser } from '@api/middleware/auth/auth-user';
import type { LoggerVariables } from '@api/middleware/logger';
import type { DatabaseContextVariables } from '@api/middleware/transaction';
import { ValidationError } from '@api/shared/errors';
import { Result } from '@api/shared/result';
import { createAmbientRoute } from '@api/shared/route/route-builder';
import { QUESTION_REPO_TOKEN } from '@api/shared/types/RepositoryToken';
import { isValidUUID } from '@api/shared/validation/constants';
import { Hono } from 'hono';
import type { IQuestionRepository } from '../domain/repositories/IQuestionRepository';
import type { IPremiumAccessService } from '../domain/services/IPremiumAccessService';
import { mapQuestionError } from '../shared/error-mapper';
import type { GetQuestionResponse } from './dto';
import { getQuestionHandler } from './handler';

// Define context variables for this route
type GetQuestionVariables = {
  user?: AuthUser; // Optional for public access with premium logic
} & LoggerVariables &
  DatabaseContextVariables;

export function getQuestionRoute(premiumAccessService: IPremiumAccessService): Hono<{
  Variables: GetQuestionVariables;
}> {
  return new Hono<{
    Variables: GetQuestionVariables;
  }>().get('/:questionId', (c) => {
    const route = createAmbientRoute<
      unknown,
      GetQuestionResponse,
      {
        questionRepo: IQuestionRepository;
        premiumAccessService: IPremiumAccessService;
      },
      GetQuestionVariables
    >(
      {
        operation: 'get',
        resource: 'question',
        requiresAuth: false,
        extractLogContext: (_body, context) => {
          const questionId = context?.req.param('questionId');
          const user = context?.get('user');
          return {
            questionId,
            isAuthenticated: !!user,
          };
        },
        extractSuccessLogData: (result) => {
          const data = result as GetQuestionResponse;
          return {
            questionId: data.question.id,
            questionType: data.question.questionType,
            isPremium: data.question.isPremium,
            optionCount: data.question.options.length,
          };
        },
        errorMapper: mapQuestionError,
      },
      async (
        _body,
        deps: {
          questionRepo: IQuestionRepository;
          premiumAccessService: IPremiumAccessService;
        },
        context
      ) => {
        // Validate and get question ID
        const questionId = context.req.param('questionId');
        if (!questionId || !isValidUUID(questionId)) {
          return Result.fail(new ValidationError('Invalid question ID format. Expected UUID.'));
        }

        // Determine authentication status
        const user = context.get('user');
        const isAuthenticated = !!user;

        // Delegate to handler
        return getQuestionHandler(
          { questionId },
          deps.questionRepo,
          deps.premiumAccessService,
          isAuthenticated
        );
      }
    );

    // Inject dependencies
    return route(c, {
      questionRepo: getRepositoryFromContext(c, QUESTION_REPO_TOKEN),
      premiumAccessService: premiumAccessService,
    });
  });
}
