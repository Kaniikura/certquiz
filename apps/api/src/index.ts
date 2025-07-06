import { Hono } from 'hono';
import {
  errorHandler,
  type LoggerVariables,
  loggerMiddleware,
  type RequestIdVariables,
  requestIdMiddleware,
  securityMiddleware,
} from './middleware';

// Import routes
import { healthRoute } from './system/health/route';

// Create app with proper type for context variables
const app = new Hono<{
  Variables: LoggerVariables & RequestIdVariables;
}>();

// Global middleware (order matters!)
app.use('*', requestIdMiddleware());
app.use('*', loggerMiddleware);
app.use('*', securityMiddleware());

// Mount routes
app.route('/health', healthRoute);
// TODO: Add more routes as features are implemented
// app.route('/api/auth', authRoutes);
// app.route('/api/quiz', quizRoutes);

// Root route
app.get('/', (c) => {
  return c.json({
    message: 'CertQuiz API - VSA Architecture',
    status: 'ready',
    version: '0.0.1',
  });
});

// Install error handler (must be after all routes)
app.onError(errorHandler);

const port = process.env.API_PORT || 4000;

export default {
  port,
  fetch: app.fetch,
};

// Start server if run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  // biome-ignore lint/suspicious/noConsole: Server startup logging
  console.log(`Server starting on port ${port}...`);
}
