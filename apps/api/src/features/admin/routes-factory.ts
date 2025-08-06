/**
 * Admin Routes Factory
 * @fileoverview Creates admin routes with role-based authentication
 */

import { UserRole } from '@api/features/auth/domain/value-objects/UserRole';
import type { QuestionId } from '@api/features/quiz/domain/value-objects/Ids';
import type { IUnitOfWork } from '@api/infra/db/IUnitOfWork';
import { getRepositoryFromContext } from '@api/infra/repositories/providers';
import { auth } from '@api/middleware/auth';
import type { DatabaseContextVariables } from '@api/middleware/transaction';
import type { AuthUser } from '@api/shared/types/auth-user';
import {
  AUTH_USER_REPO_TOKEN,
  QUESTION_REPO_TOKEN,
  QUIZ_REPO_TOKEN,
  type RepositoryToken,
  USER_REPO_TOKEN,
} from '@api/shared/types/RepositoryToken';
import { UUID_REGEX } from '@api/shared/validation/constants';
import type { Context } from 'hono';
import { Hono } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import type { DeleteQuizParams } from './delete-quiz/dto';
import { deleteQuizHandler } from './delete-quiz/handler';
import { getSystemStatsHandler } from './get-system-stats/handler';
import type { ListPendingQuestionsParams } from './list-pending-questions/dto';
import { listPendingQuestionsHandler } from './list-pending-questions/handler';
import type { ListQuizzesParams } from './list-quizzes/dto';
import { listQuizzesHandler } from './list-quizzes/handler';
import type { ListUsersParams } from './list-users/dto';
import { listUsersHandler } from './list-users/handler';
import type { ModerateQuestionParams } from './moderate-questions/dto';
import { moderateQuestionHandler } from './moderate-questions/handler';
import type { UpdateUserRolesParams } from './update-user-roles/dto';
import { updateUserRolesHandler } from './update-user-roles/handler';

/**
 * Create unit of work for read-only admin operations
 * Extracted helper to reduce code duplication for operations that don't need transactions
 */
function createReadOnlyUnitOfWork(
  c: Context<{ Variables: { user: AuthUser } & DatabaseContextVariables }>,
  tokens: RepositoryToken<unknown>[]
): IUnitOfWork {
  const repositories = new Map<RepositoryToken<unknown>, unknown>();

  // Pre-fetch all required repositories
  for (const token of tokens) {
    repositories.set(token, getRepositoryFromContext(c, token));
  }

  return {
    getRepository: <T>(token: RepositoryToken<T>): T => {
      const repo = repositories.get(token as RepositoryToken<unknown>);
      if (!repo) {
        throw new Error('Unknown repository token');
      }
      return repo as T;
    },
    begin: async () => {
      // No-op for read-only operations
    },
    commit: async () => {
      // No-op for read-only operations
    },
    rollback: async () => {
      // No-op for read-only operations
    },
    getQuestionDetailsService: () => {
      // Admin routes don't need question details service
      throw new Error('Question details service not needed for admin operations');
    },
  };
}

/**
 * Execute admin write operation within a database transaction
 * Ensures data consistency and automatic rollback on errors
 */
async function executeWithTransaction<T>(
  c: Context<{ Variables: { user: AuthUser } & DatabaseContextVariables }>,
  operation: (unitOfWork: IUnitOfWork) => Promise<T>
): Promise<T> {
  const dbContext = c.get('dbContext');
  return dbContext.withinTransaction(async (txCtx) => {
    // Create a UnitOfWork adapter that wraps the transaction context
    const unitOfWork: IUnitOfWork = {
      getRepository: <R>(token: RepositoryToken<R>): R => {
        return txCtx.getRepository(token);
      },
      begin: async () => {
        // No-op - transaction already started by dbContext.withinTransaction
      },
      commit: async () => {
        // No-op - transaction will be committed automatically by dbContext.withinTransaction
      },
      rollback: async () => {
        // No-op - transaction will be rolled back automatically on error
      },
      getQuestionDetailsService: () => {
        // Admin routes don't need question details service
        throw new Error('Question details service not needed for admin operations');
      },
    };

    return operation(unitOfWork);
  });
}

/**
 * Handle route errors with appropriate status codes
 * Extracted helper to reduce complexity
 */
function handleRouteError(error: unknown): {
  success: false;
  error: {
    code: string;
    message: string;
  };
} {
  // Simple error handling for most routes
  return {
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: error instanceof Error ? error.message : 'An unexpected error occurred',
    },
  };
}

/**
 * Handle update user roles errors with detailed status mapping
 * Extracted helper for complex error handling
 */
function handleUpdateUserRolesError(error: unknown): {
  response: {
    success: false;
    error: {
      code: string;
      message: string;
    };
  };
  status: ContentfulStatusCode;
} {
  let status = 500;
  let code = 'INTERNAL_ERROR';

  if (error instanceof Error) {
    if (error.name === 'ValidationError') {
      status = 400;
      code = 'VALIDATION_ERROR';
    } else if (error.name === 'NotFoundError') {
      status = 404;
      code = 'NOT_FOUND';
    } else if (error.name === 'AdminPermissionError') {
      status = 403;
      code = 'ADMIN_PERMISSION_ERROR';
    }
  }

  return {
    response: {
      success: false,
      error: {
        code,
        message: error instanceof Error ? error.message : 'An unexpected error occurred',
      },
    },
    status: status as ContentfulStatusCode,
  };
}

/**
 * Handle moderation errors with appropriate status codes and HTTP status
 * Extracted helper for moderation-specific error handling with proper HTTP codes
 */
function handleModerationErrorWithStatus(error: unknown): {
  response: {
    success: false;
    error: {
      code: string;
      message: string;
    };
  };
  status: ContentfulStatusCode;
} {
  let status = 500;

  if (error instanceof Error) {
    if (error.name === 'ValidationError') {
      status = 400;
      return {
        response: {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: error.message,
          },
        },
        status: status as ContentfulStatusCode,
      };
    } else if (error.name === 'QuestionNotFoundError' || error.name === 'NotFoundError') {
      status = 404;
      return {
        response: {
          success: false,
          error: {
            code: 'QUESTION_NOT_FOUND',
            message: error.message,
          },
        },
        status: status as ContentfulStatusCode,
      };
    } else if (error.name === 'InvalidQuestionDataError') {
      status = 400;
      return {
        response: {
          success: false,
          error: {
            code: 'INVALID_QUESTION_DATA',
            message: error.message,
          },
        },
        status: status as ContentfulStatusCode,
      };
    }
  }

  return {
    response: {
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: error instanceof Error ? error.message : 'An unexpected error occurred',
      },
    },
    status: status as ContentfulStatusCode,
  };
}

/**
 * Create admin routes - all require admin role
 */
export function createAdminRoutes(): Hono<{
  Variables: { user: AuthUser } & DatabaseContextVariables;
}> {
  const adminRoutes = new Hono<{ Variables: { user: AuthUser } & DatabaseContextVariables }>();

  // Apply admin authentication to all routes
  adminRoutes.use('*', auth({ roles: ['admin'] }));

  // GET /api/admin/stats - System statistics
  adminRoutes.get('/stats', async (c) => {
    try {
      const unitOfWork = createReadOnlyUnitOfWork(c, [
        AUTH_USER_REPO_TOKEN,
        USER_REPO_TOKEN,
        QUIZ_REPO_TOKEN,
        QUESTION_REPO_TOKEN,
      ]);

      const stats = await getSystemStatsHandler(unitOfWork);

      return c.json({
        success: true,
        data: stats,
      });
    } catch (error) {
      return c.json(handleRouteError(error), 500);
    }
  });

  /**
   * GET /api/admin/users - List all users
   */
  adminRoutes.get('/users', async (c) => {
    try {
      const unitOfWork = createReadOnlyUnitOfWork(c, [AUTH_USER_REPO_TOKEN]);

      // Parse query parameters
      const query = c.req.query();
      const params: ListUsersParams = {
        page: parseInt(query.page || '1', 10),
        pageSize: parseInt(query.pageSize || '20', 10),
        search: query.search,
        role: query.role ? UserRole.fromString(query.role) : undefined,
        isActive: query.isActive ? query.isActive === 'true' : undefined,
      };

      const result = await listUsersHandler(params, unitOfWork);

      return c.json({
        success: true,
        data: result,
      });
    } catch (error) {
      return c.json(handleRouteError(error), 500);
    }
  });

  /**
   * PATCH /api/admin/users/:id/roles - Update user roles
   */
  adminRoutes.patch('/users/:id/roles', async (c) => {
    try {
      const userId = c.req.param('id');
      const adminUser = c.get('user');

      // Parse request body
      const body = await c.req.json();
      const params: UpdateUserRolesParams = {
        userId,
        role: body.role,
        updatedBy: adminUser.sub,
      };

      const result = await executeWithTransaction(c, async (unitOfWork) => {
        return updateUserRolesHandler(params, unitOfWork);
      });

      return c.json({
        success: true,
        data: result,
      });
    } catch (error) {
      const errorResponse = handleUpdateUserRolesError(error);
      return c.json(errorResponse.response, errorResponse.status);
    }
  });

  /**
   * GET /api/admin/quizzes - List all quizzes for oversight
   */
  adminRoutes.get('/quizzes', async (c) => {
    try {
      const unitOfWork = createReadOnlyUnitOfWork(c, [QUIZ_REPO_TOKEN]);

      // Parse query parameters
      const query = c.req.query();
      const params: ListQuizzesParams = {
        page: parseInt(query.page || '1', 10),
        pageSize: parseInt(query.pageSize || '20', 10),
        state: query.state,
        userId: query.userId,
        dateFrom: query.dateFrom ? new Date(query.dateFrom) : undefined,
        dateTo: query.dateTo ? new Date(query.dateTo) : undefined,
      };

      const result = await listQuizzesHandler(params, unitOfWork);

      return c.json({
        success: true,
        data: result,
      });
    } catch (error) {
      return c.json(handleRouteError(error), 500);
    }
  });

  /**
   * DELETE /api/admin/quiz/:id - Delete a quiz
   */
  adminRoutes.delete('/quiz/:id', async (c) => {
    try {
      const quizId = c.req.param('id');
      const adminUser = c.get('user');

      // Parse request body for deletion reason
      const body = await c.req.json().catch(() => ({}));
      const params: DeleteQuizParams = {
        quizId,
        deletedBy: adminUser.sub,
        reason: body.reason || 'Admin deletion - no reason provided',
      };

      const result = await executeWithTransaction(c, async (unitOfWork) => {
        return deleteQuizHandler(params, unitOfWork);
      });

      return c.json({
        success: true,
        data: result,
      });
    } catch (error) {
      const errorResponse = handleUpdateUserRolesError(error);
      return c.json(errorResponse.response, errorResponse.status);
    }
  });

  /**
   * GET /api/admin/questions/pending - List questions pending moderation
   */
  adminRoutes.get('/questions/pending', async (c) => {
    try {
      const unitOfWork = createReadOnlyUnitOfWork(c, [QUESTION_REPO_TOKEN]);

      // Parse query parameters
      const query = c.req.query();
      const params: ListPendingQuestionsParams = {
        page: parseInt(query.page || '1', 10),
        pageSize: parseInt(query.pageSize || '20', 10),
        status: query.status as 'DRAFT' | 'ACTIVE' | 'INACTIVE' | 'ARCHIVED' | undefined,
        dateFrom: query.dateFrom ? new Date(query.dateFrom) : undefined,
        dateTo: query.dateTo ? new Date(query.dateTo) : undefined,
        examType: query.examType,
        difficulty: query.difficulty as ListPendingQuestionsParams['difficulty'],
        orderBy: query.orderBy as ListPendingQuestionsParams['orderBy'],
        orderDir: query.orderDir as ListPendingQuestionsParams['orderDir'],
      };

      const result = await listPendingQuestionsHandler(params, unitOfWork);

      return c.json({
        success: true,
        data: result,
      });
    } catch (error) {
      return c.json(handleRouteError(error), 500);
    }
  });

  /**
   * PATCH /api/admin/questions/:id/moderate - Moderate a question
   */
  adminRoutes.patch('/questions/:id/moderate', async (c) => {
    try {
      const questionId = c.req.param('id');
      const adminUser = c.get('user');

      // Validate questionId format
      if (!UUID_REGEX.test(questionId)) {
        return c.json(
          {
            success: false,
            error: {
              code: 'INVALID_ID_FORMAT',
              message: 'Invalid question ID format. Must be a valid UUID.',
            },
          },
          400
        );
      }

      // Parse request body
      const body = await c.req.json();
      const params: ModerateQuestionParams = {
        questionId: questionId as QuestionId,
        action: body.action,
        moderatedBy: adminUser.sub,
        feedback: body.feedback,
      };

      const result = await executeWithTransaction(c, async (unitOfWork) => {
        return moderateQuestionHandler(params, unitOfWork);
      });

      return c.json({
        success: true,
        data: result,
      });
    } catch (error) {
      const { response, status } = handleModerationErrorWithStatus(error);
      return c.json(response, status);
    }
  });

  /**
   * Health check for admin service
   */
  adminRoutes.get('/health', (c) => {
    const user = c.get('user');
    return c.json({
      service: 'admin',
      status: 'healthy',
      authenticatedAs: user.sub,
      roles: user.roles,
      timestamp: new Date().toISOString(),
    });
  });

  return adminRoutes;
}
