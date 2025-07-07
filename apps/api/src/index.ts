import { Hono } from 'hono';
import pino from 'pino';
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
export const app = new Hono<{
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
  const pkg = require('../package.json');
  return c.json({
    message: 'CertQuiz API - VSA Architecture',
    status: 'ready',
    version: pkg.version,
  });
});

// Install error handler (must be after all routes)
app.onError(errorHandler);

// 404 handler for unmatched routes - must be last!
app.all('*', (c) => {
  return c.json(
    {
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: `Route ${c.req.method} ${c.req.path} not found`,
      },
    },
    404
  );
});

// -----------------------------------------------------------------
// Bun automatically starts the server when it sees this default export
// with { port?, fetch } shape. No explicit Bun.serve() needed!
// -----------------------------------------------------------------
const port = Number(process.env.API_PORT) || 4000;

// Create startup logger
const startupLogger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport:
    process.env.NODE_ENV === 'development'
      ? {
          target: 'pino-pretty',
          options: {
            colorize: true,
            ignore: 'pid,hostname',
            translateTime: 'HH:MM:ss.l',
          },
        }
      : undefined,
});

// Log startup info when running as main module
if (import.meta.main) {
  startupLogger.info(`🚀 CertQuiz API listening on :${port}`);
  startupLogger.info('📊 Health endpoints:');
  startupLogger.info(`  - Liveness:  http://localhost:${port}/health/live`);
  startupLogger.info(`  - Readiness: http://localhost:${port}/health/ready`);
  startupLogger.info(`  - Legacy:    http://localhost:${port}/health`);
}

// Bun recognizes this export shape and starts the server automatically
export default {
  port,
  fetch: app.fetch,
};
