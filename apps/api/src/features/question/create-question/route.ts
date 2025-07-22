/**
 * Create question route implementation
 * @fileoverview HTTP endpoint for admin question creation
 */

import type { AuthUser } from '@api/middleware/auth/auth-user';
import type { LoggerVariables } from '@api/middleware/logger';
import type { Clock } from '@api/shared/clock';
import type { IdGenerator } from '@api/shared/id-generator';
import { Hono } from 'hono';
import type { IQuestionRepository } from '../domain/repositories/IQuestionRepository';
import { mapQuestionError } from '../shared/error-mapper';
import { createQuestionHandler } from './handler';

// Define context variables for this route
type CreateQuestionVariables = {
  questionRepository: IQuestionRepository;
  clock: Clock;
  idGenerator: IdGenerator;
  user: AuthUser; // Required for admin authorization
} & LoggerVariables;

export const createQuestionRoute = new Hono<{
  Variables: CreateQuestionVariables;
}>().post('/questions', async (c): Promise<Response> => {
  const logger = c.get('logger');

  try {
    // Validate Content-Type header
    const contentType = c.req.header('Content-Type');
    if (!contentType || !contentType.includes('application/json')) {
      logger.warn('Invalid Content-Type header', {
        providedContentType: contentType,
        expectedContentType: 'application/json',
      });

      return c.json(
        {
          success: false,
          error: {
            code: 'INVALID_CONTENT_TYPE',
            message: 'Content-Type must be application/json',
          },
        },
        400
      );
    }

    // Get request body
    let body: unknown;
    try {
      body = await c.req.json();
    } catch (jsonError) {
      logger.warn('Invalid JSON in request body', {
        error: jsonError instanceof Error ? jsonError.message : String(jsonError),
      });
      return c.json(
        {
          success: false,
          error: {
            code: 'INVALID_JSON',
            message: 'Invalid JSON in request body',
          },
        },
        400
      );
    }

    // Get authenticated user (required for admin routes)
    const user = c.get('user');

    // Type guard for logging purposes only
    const logBody = body as { questionType?: string; isPremium?: boolean } | null;
    logger.info('Create question attempt', {
      userId: user.sub,
      userRoles: user.roles,
      questionType: logBody?.questionType,
      isPremium: logBody?.isPremium,
    });

    // Get dependencies from DI container/context
    const questionRepository = c.get('questionRepository');
    const clock = c.get('clock');
    const idGenerator = c.get('idGenerator');

    // Delegate to handler
    const result = await createQuestionHandler(
      body,
      questionRepository,
      clock,
      idGenerator,
      user.sub,
      user.roles
    );

    if (!result.success) {
      const error = result.error;

      // Log question creation failure
      logger.warn('Create question failed', {
        userId: user.sub,
        userRoles: user.roles,
        errorType: error.name,
        errorMessage: error.message,
      });

      const { status, body: errorBody } = mapQuestionError(error);
      return c.json(errorBody, status);
    }

    // Log successful question creation
    logger.info('Create question successful', {
      userId: user.sub,
      userRoles: user.roles,
      questionId: result.data.question.id,
      questionType: result.data.question.questionType,
      isPremium: result.data.question.isPremium,
      status: result.data.question.status,
    });

    return c.json(
      {
        success: true,
        data: result.data,
      },
      201
    );
  } catch (error) {
    logger.error('Create question route error', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    const { status, body: errorBody } = mapQuestionError(
      error instanceof Error ? error : new Error('Unknown error')
    );
    return c.json(errorBody, status);
  }
});
