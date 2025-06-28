import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { env } from './config';
import { createCache } from './config/redis';
import { createLogger } from './lib/logger';
import { healthRoutes } from './routes/health';
import type { AppEnv } from './types/app';

const app = new Hono<AppEnv>();

// Initialize logger
const appLogger = createLogger('server');

// Cache instance
const cache = createCache();

// Global middleware
app.use('*', logger());
app.use(
  '*',
  cors({
    origin: env.FRONTEND_URL || 'http://localhost:5173',
    credentials: true,
  })
);

// Inject cache into context
app.use('*', async (c, next) => {
  c.set('cache', cache);
  await next();
});

// Error handling
app.onError((err, c) => {
  appLogger.error({ err, path: c.req.path, method: c.req.method }, 'Application error');
  return c.json(
    {
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An error occurred',
      },
    },
    500
  );
});

// Mount routes
app.route('/health', healthRoutes);

// 404 handler
app.notFound((c) => {
  return c.json(
    {
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: 'Route not found',
      },
    },
    404
  );
});

// Start server when run directly (not imported)
if (import.meta.main) {
  const port = env.API_PORT || 4000;

  // Initialize cache and start server
  (async () => {
    try {
      await cache.init();
      appLogger.info({ port, cacheDriver: env.CACHE_DRIVER }, '🔥 Server starting');

      serve({
        fetch: app.fetch,
        port,
      });

      appLogger.info(`✅ API started on :${port} with ${env.CACHE_DRIVER} cache`);
    } catch (error) {
      appLogger.error({ err: error }, 'Failed to start server');
      process.exit(1);
    }
  })();
}

export default app;
export type { App } from './types/app';
