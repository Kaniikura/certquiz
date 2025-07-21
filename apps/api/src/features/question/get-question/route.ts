/**
 * Get question route implementation
 * @fileoverview HTTP endpoint for retrieving detailed question information
 */

import type { SupportedStatusCode } from '@api/features/quiz/shared/route-utils';
import type { AuthUser } from '@api/middleware/auth/auth-user';
import type { LoggerVariables } from '@api/middleware/logger';
import { Hono } from 'hono';
import type { IQuestionRepository } from '../domain/repositories/IQuestionRepository';
import { mapQuestionError } from '../shared/error-mapper';
import { getQuestionHandler } from './handler';

// Define context variables for this route
type GetQuestionVariables = {
  questionRepository: IQuestionRepository;
  user?: AuthUser; // Optional for public access with premium logic
} & LoggerVariables;

export const getQuestionRoute = new Hono<{
  Variables: GetQuestionVariables;
}>().get('/questions/:questionId', async (c) => {
  const logger = c.get('logger');

  try {
    // Get question ID from URL parameter
    const questionId = c.req.param('questionId');

    // Validate questionId format early to fail fast
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!questionId || !uuidRegex.test(questionId)) {
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

    // Delegate to handler
    const result = await getQuestionHandler({ questionId }, questionRepository, isAuthenticated);

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
      return c.json(errorBody, status as SupportedStatusCode);
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
    return c.json(errorBody, status as SupportedStatusCode);
  }
});
