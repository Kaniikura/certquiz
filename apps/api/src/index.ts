import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { serve } from '@hono/node-server';
import type { AppEnv } from './types/app';
import { healthRoutes } from './routes/health';
import { env } from './config';
import { getRedisClient } from './config/redis';

const app = new Hono<AppEnv>();

// Initialize Redis client
const redis = getRedisClient();

// Global middleware
app.use('*', logger());
app.use('*', cors({
  origin: env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}));

// Inject Redis client into context
app.use('*', async (c, next) => {
  c.set('redis', redis);
  await next();
});

// Error handling
app.onError((err, c) => {
  console.error('Application error:', err);
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
  console.log(`🔥 Server starting on port ${port}`);

  serve({
    fetch: app.fetch,
    port,
  });
}

export default app;
export type { App } from './types/app';