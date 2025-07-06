import { Hono } from 'hono';
import type { LoggerVariables } from '../../middleware/logger';
import type { RequestIdVariables } from '../../middleware/request-id';
import { healthCheckHandler } from './handler';

/**
 * Health check route
 *
 * Provides system health information for monitoring.
 * This endpoint should not require authentication.
 */
export const healthRoute = new Hono<{
  Variables: LoggerVariables & RequestIdVariables;
}>().get('/', async (c) => {
  const logger = c.get('logger');

  try {
    const health = await healthCheckHandler();

    // Only log health checks at debug level to reduce noise
    logger.debug({ health }, 'Health check performed');

    return c.json(health);
  } catch (error) {
    logger.error({ error }, 'Health check failed');

    return c.json(
      {
        status: 'unhealthy',
        service: 'certquiz-api',
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      503 // Service Unavailable
    );
  }
});
