/**
 * Get question route implementation
 * @fileoverview HTTP endpoint for retrieving detailed question information
 */

import type { AuthUser } from '@api/middleware/auth/auth-user';
import type { LoggerVariables } from '@api/middleware/logger';
import { UUID_REGEX } from '@api/shared/validation/constants';
import { Hono } from 'hono';
import type { IQuestionRepository } from '../domain/repositories/IQuestionRepository';
import { PremiumAccessService } from '../domain/services';
import { mapQuestionError } from '../shared/error-mapper';
import { getQuestionHandler } from './handler';

// Define context variables for this route
type GetQuestionVariables = {
  questionRepository: IQuestionRepository;
  user?: AuthUser; // Optional for public access with premium logic
} & LoggerVariables;

export const getQuestionRoute = new Hono<{
  Variables: GetQuestionVariables;
}>().get('/:questionId', async (c): Promise<Response> => {
  const logger = c.get('logger');

  try {
    // Get question ID from URL parameter
    const questionId = c.req.param('questionId');

    // Validate questionId format early to fail fast
    if (!questionId || !UUID_REGEX.test(questionId)) {
      logger.warn('Invalid question ID format', {
        questionId,
        expectedFormat: 'UUID',
      });

      return c.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid question ID format. Expected UUID.',
          },
        },
        400
      );
    }

    // Determine authentication status
    const user = c.get('user');
    const isAuthenticated = !!user;

    logger.info('Get question attempt', {
      questionId,
      isAuthenticated,
      userId: user?.sub,
    });

    // Get dependencies from DI container/context
    const questionRepository = c.get('questionRepository');

    // Create premium access service instance
    const premiumAccessService = new PremiumAccessService();

    // Delegate to handler
    const result = await getQuestionHandler(
      { questionId },
      questionRepository,
      premiumAccessService,
      isAuthenticated
    );

    if (!result.success) {
      const error = result.error;

      // Log question retrieval failure
      logger.warn('Get question failed', {
        questionId,
        isAuthenticated,
        userId: user?.sub,
        errorType: error.name,
        errorMessage: error.message,
      });

      const { status, body: errorBody } = mapQuestionError(error);
      return c.json(errorBody, status);
    }

    // Log successful question retrieval
    logger.info('Get question successful', {
      questionId,
      isAuthenticated,
      userId: user?.sub,
      questionType: result.data.question.questionType,
      isPremium: result.data.question.isPremium,
      optionCount: result.data.question.options.length,
    });

    return c.json({
      success: true,
      data: result.data,
    });
  } catch (error) {
    logger.error('Get question route error', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    const { status, body: errorBody } = mapQuestionError(
      error instanceof Error ? error : new Error('Unknown error')
    );
    return c.json(errorBody, status);
  }
});
