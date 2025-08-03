/**
 * Get question route implementation
 * @fileoverview HTTP endpoint for retrieving detailed question information
 */

import { getRepositoryFromContext } from '@api/infra/repositories/providers';
import { ValidationError } from '@api/shared/errors';
import { Result } from '@api/shared/result';
import { createStandardRoute } from '@api/shared/route/routeConfigHelpers';
import { QUESTION_REPO_TOKEN } from '@api/shared/types/RepositoryToken';
import { isValidUUID } from '@api/shared/validation/constants';
import type { IQuestionRepository } from '../domain/repositories/IQuestionRepository';
import type { IPremiumAccessService } from '../domain/services/IPremiumAccessService';
import { mapQuestionError } from '../shared/error-mapper';
import type { GetQuestionResponse } from './dto';
import { getQuestionHandler } from './handler';

export function getQuestionRoute(premiumAccessService: IPremiumAccessService) {
  return createStandardRoute<
    unknown,
    GetQuestionResponse,
    {
      questionRepo: IQuestionRepository;
      premiumAccessService: IPremiumAccessService;
    }
  >({
    method: 'get',
    path: '/:questionId',
    configOptions: {
      operation: 'get',
      resource: 'question',
      requiresAuth: false,
      logging: {
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
      },
      errorMapper: mapQuestionError,
    },
    handler: async (_body, deps, context) => {
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
    },
    getDependencies: (c) => ({
      questionRepo: getRepositoryFromContext(c, QUESTION_REPO_TOKEN),
      premiumAccessService: premiumAccessService,
    }),
  });
}
