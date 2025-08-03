/**
 * Admin Routes Factory
 * @fileoverview Creates admin routes with role-based authentication
 */

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
import { Hono } from 'hono';
import { getSystemStatsHandler } from './get-system-stats/handler';

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
      const authUserRepo = getRepositoryFromContext(c, AUTH_USER_REPO_TOKEN);
      const userRepo = getRepositoryFromContext(c, USER_REPO_TOKEN);
      const quizRepo = getRepositoryFromContext(c, QUIZ_REPO_TOKEN);
      const questionRepo = getRepositoryFromContext(c, QUESTION_REPO_TOKEN);

      // Create a mock unit of work that provides the repositories
      const unitOfWork: IUnitOfWork = {
        getRepository: <T>(token: RepositoryToken<T>): T => {
          if (token === AUTH_USER_REPO_TOKEN) return authUserRepo as T;
          if (token === USER_REPO_TOKEN) return userRepo as T;
          if (token === QUIZ_REPO_TOKEN) return quizRepo as T;
          if (token === QUESTION_REPO_TOKEN) return questionRepo as T;
          throw new Error('Unknown repository token');
        },
        // These methods are not needed for read-only operations
        begin: async () => {
          // No-op for read-only operation
        },
        commit: async () => {
          // No-op for read-only operation
        },
        rollback: async () => {
          // No-op for read-only operation
        },
      };

      const stats = await getSystemStatsHandler(unitOfWork);

      return c.json({
        success: true,
        data: stats,
      });
    } catch (error) {
      // Error will be handled by Hono error boundary
      return c.json(
        {
          success: false,
          error: {
            code: 'INTERNAL_ERROR',
            message: error instanceof Error ? error.message : 'An unexpected error occurred',
          },
        },
        500
      );
    }
  });

  /**
   * GET /api/admin/users - List all users
   */
  adminRoutes.get('/users', async (c) => {
    // TODO: Implement user listing with pagination
    return c.json({
      success: true,
      data: {
        users: [],
        page: 1,
        total: 0,
      },
    });
  });

  /**
   * PATCH /api/admin/users/:id/roles - Update user roles
   */
  adminRoutes.patch('/users/:id/roles', async (c) => {
    const userId = c.req.param('id');
    const adminUser = c.get('user');

    // TODO: Implement role update
    return c.json({
      success: true,
      data: {
        userId,
        updatedBy: adminUser.sub,
        message: 'Role update coming soon',
      },
    });
  });

  /**
   * DELETE /api/admin/quiz/:id - Delete a quiz
   */
  adminRoutes.delete('/quiz/:id', async (c) => {
    const quizId = c.req.param('id');
    const adminUser = c.get('user');

    // TODO: Implement quiz deletion
    return c.json({
      success: true,
      data: {
        quizId,
        deletedBy: adminUser.sub,
        message: 'Quiz deletion coming soon',
      },
    });
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
