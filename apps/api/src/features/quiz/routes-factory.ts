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
    // TODO: Implement public quiz catalog functionality
    // Epic: Public Quiz Catalog Implementation
    // Story: https://github.com/Kaniikura/certquiz/issues/43
    //
    // Required Implementation:
    // - Create IQuestionRepository implementation with DrizzleQuestionRepository
    // - Add efficient pagination (limit/offset or cursor-based)
    // - Implement Redis caching layer for 200ms P95 response time
    // - Add filtering by examType, category, difficulty, isPremium
    // - Full-text search using PostgreSQL tsvector
    // - Premium content access control based on user roles
    // - Comprehensive integration tests covering performance requirements
    //
    // Dependencies:
    // - Question bounded context (separate from QuizSession)
    // - Database tables: question, questionVersion
    // - Redis cache configuration
    // - Performance monitoring and alerting
    //
    // See: /features/question/domain/repositories/IQuestionRepository.ts
    return c.json(
      {
        error: 'Public quiz catalog not yet implemented',
        code: 'NOT_IMPLEMENTED',
        message:
          'This endpoint requires full Question catalog implementation with pagination, caching, and filtering. See TODO comments for requirements.',
        documentation: 'https://github.com/Kaniikura/certquiz/issues/43',
      },
      501
    );
  });

  // GET /api/quiz/:id - Get quiz details (public preview)
  publicRoutes.get('/:id', async (c) => {
    const id = c.req.param('id');
    // TODO: Implement public quiz preview functionality
    // Part of: Public Quiz Catalog Implementation
    // Story: https://github.com/Kaniikura/certquiz/issues/43
    //
    // Required Implementation:
    // - Use IQuestionRepository.findQuestionById()
    // - Return question summary without correct answers
    // - Implement premium access control
    // - Add Redis caching for performance
    // - Proper error handling for not found questions
    //
    // See: /features/question/domain/repositories/IQuestionRepository.ts
    return c.json(
      {
        error: 'Quiz preview not yet implemented',
        code: 'NOT_IMPLEMENTED',
        message: `Quiz preview for ID ${id} requires Question catalog implementation. See TODO comments for requirements.`,
        documentation: 'https://github.com/Kaniikura/certquiz/issues/43',
      },
      501
    );
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

  // Health check MUST be defined before wildcard routes like /:id
  quizRoutes.get('/health', (c) => {
    return c.json({
      service: 'quiz',
      status: 'healthy',
      timestamp: new Date().toISOString(),
    });
  });

  // Mount premium routes BEFORE other routes to ensure they take precedence
  quizRoutes.route('/premium', premiumRoutes);

  // Mount public routes (contains /:id wildcard)
  quizRoutes.route('/', publicRoutes);

  // Mount protected routes (includes generic /:id routes)
  quizRoutes.route('/', protectedRoutes);

  return quizRoutes;
}
