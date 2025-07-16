/**
 * Quiz Routes Factory
 * @fileoverview Creates quiz routes with authentication and dependency injection
 */

import { auth } from '@api/middleware/auth';
import type { AuthUser } from '@api/middleware/auth/auth-user';
import { Hono } from 'hono';
import type { IQuizRepository } from './domain/repositories/IQuizRepository';

/**
 * Create quiz routes with public and protected sections
 */
export function createQuizRoutes(_quizRepository: IQuizRepository): Hono {
  // Public routes - no authentication required
  const publicRoutes = new Hono();

  // GET /api/quiz - List available quizzes (public browsing)
  publicRoutes.get('/', async (c) => {
    // TODO: Implement public quiz listing
    return c.json({
      success: true,
      data: {
        quizzes: [],
        message: 'Public quiz listing coming soon',
      },
    });
  });

  // GET /api/quiz/:id - Get quiz details (public preview)
  publicRoutes.get('/:id', async (c) => {
    const id = c.req.param('id');
    // TODO: Implement public quiz preview
    return c.json({
      success: true,
      data: {
        id,
        message: 'Public quiz preview coming soon',
      },
    });
  });

  // Protected routes - authentication required
  const protectedRoutes = new Hono<{ Variables: { user: AuthUser } }>();

  // Apply authentication middleware to all protected routes
  protectedRoutes.use('*', auth());

  // POST /api/quiz - Create a new quiz (authenticated users)
  protectedRoutes.post('/', async (c) => {
    const user = c.get('user'); // Type-safe access to authenticated user
    // TODO: Implement quiz creation
    return c.json({
      success: true,
      data: {
        message: 'Quiz creation coming soon',
        createdBy: user.sub,
      },
    });
  });

  // POST /api/quiz/:id/start - Start a quiz session (authenticated users)
  protectedRoutes.post('/:id/start', async (c) => {
    const id = c.req.param('id');
    const user = c.get('user');
    // TODO: Implement quiz session start
    return c.json({
      success: true,
      data: {
        quizId: id,
        userId: user.sub,
        message: 'Quiz session start coming soon',
      },
    });
  });

  // Premium routes - require premium role
  const premiumRoutes = new Hono<{ Variables: { user: AuthUser } }>();

  // Apply auth with premium role requirement
  premiumRoutes.use('*', auth({ roles: ['premium', 'admin'] }));

  // GET /api/quiz/premium - List premium quizzes
  premiumRoutes.get('/', async (c) => {
    const user = c.get('user');
    return c.json({
      success: true,
      data: {
        message: 'Premium quiz listing coming soon',
        userId: user.sub,
        roles: user.roles || [],
      },
    });
  });

  // POST /api/quiz/premium/:id/unlock - Unlock premium content
  premiumRoutes.post('/:id/unlock', async (c) => {
    const id = c.req.param('id');
    const user = c.get('user');
    return c.json({
      success: true,
      data: {
        quizId: id,
        unlockedBy: user.sub,
        message: 'Premium unlock coming soon',
      },
    });
  });

  // Combine all routes
  const quizRoutes = new Hono();

  // IMPORTANT: Mount more specific routes first (Hono matches in order)
  // Mount premium routes BEFORE other routes to ensure they take precedence
  quizRoutes.route('/premium', premiumRoutes);

  // Mount public routes
  quizRoutes.route('/', publicRoutes);

  // Mount protected routes (includes generic /:id routes)
  quizRoutes.route('/', protectedRoutes);

  // Health check for quiz service
  quizRoutes.get('/health', (c) => {
    return c.json({
      service: 'quiz',
      status: 'healthy',
      timestamp: new Date().toISOString(),
    });
  });

  return quizRoutes;
}
