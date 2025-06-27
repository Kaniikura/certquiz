import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { serve } from '@hono/node-server';
import type { AppEnv } from './types/app';
import { healthRoutes } from './routes/health';
import { env } from './config';
import { getRedisClient } from './config/redis';
import { createLogger } from './lib/logger';
import type { RedisClientType } from 'redis';

const app = new Hono<AppEnv>();

// Initialize logger
const appLogger = createLogger('server');

// Redis client will be initialized asynchronously
let redisClient: RedisClientType | null = null;

// Initialize Redis client asynchronously
async function initializeRedis(): Promise<void> {
  try {
    redisClient = await getRedisClient();
    appLogger.info('Redis client initialized successfully');
  } catch (error) {
    appLogger.error({ err: error }, 'Failed to initialize Redis client');
    throw error;
  }
}

// Global middleware
app.use('*', logger());
app.use('*', cors({
  origin: env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}));

// Inject Redis client into context
app.use('*', async (c, next) => {
  if (redisClient) {
    c.set('redis', redisClient);
  }
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
        message: 'An error occurred' 
      } 
    },
    500
  );
});

// Mount routes
app.route('/health', healthRoutes);

// 404 handler
app.notFound((c) => {
  return c.json({ 
    success: false, 
    error: { 
      code: 'NOT_FOUND', 
      message: 'Route not found' 
    } 
  }, 404);
});

// Start server when run directly (not imported)
if (import.meta.main) {
  const port = env.API_PORT || 4000;
  
  // Initialize Redis and start server
  (async () => {
    try {
      await initializeRedis();
      appLogger.info({ port }, '🔥 Server starting');

      serve({
        fetch: app.fetch,
        port,
      });
    } catch (error) {
      appLogger.error({ err: error }, 'Failed to start server');
      process.exit(1);
    }
  })();
}

export default app;
export type { App } from './types/app';