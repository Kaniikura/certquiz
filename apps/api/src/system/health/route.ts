import { Hono } from 'hono';
import { ping } from '../../infra/db/client';
import type { LoggerVariables } from '../../middleware/logger';
import type { RequestIdVariables } from '../../middleware/request-id';
import { livenessCheckHandler, readinessCheckHandler } from './handler';

/**
 * Health check routes
 *
 * Provides two endpoints for system health monitoring:
 * - /live: Liveness probe (lightweight, internal checks)
 * - /ready: Readiness probe (external dependency checks)
 *
 * These endpoints should not require authentication.
 */
export const healthRoute = new Hono<{
  Variables: LoggerVariables & RequestIdVariables;
}>()
  // Liveness endpoint - lightweight internal health check
  .get('/live', (c) => {
    const logger = c.get('logger');

    try {
      const health = livenessCheckHandler();

      // Only log health checks at debug level to reduce noise
      logger.debug({ health }, 'Liveness check performed');

      return c.json(health);
    } catch (error) {
      logger.error({ error }, 'Liveness check failed');

      // If liveness fails, the process is unhealthy
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
  })
  // Readiness endpoint - checks external dependencies
  .get('/ready', async (c) => {
    const logger = c.get('logger');

    try {
      const health = await readinessCheckHandler({
        db: { ping },
      });

      // Only log health checks at debug level to reduce noise
      logger.debug({ health }, 'Readiness check performed');

      return c.json(health);
    } catch (error) {
      logger.error({ error }, 'Readiness check failed');

      return c.json(
        {
          status: 'unhealthy',
          timestamp: new Date().toISOString(),
          services: {
            database: {
              status: 'unhealthy',
            },
          },
          error: error instanceof Error ? error.message : 'Unknown error',
        },
        503 // Service Unavailable
      );
    }
  })
  // Legacy endpoint for backward compatibility - defaults to readiness
  .get('/', async (c) => {
    const logger = c.get('logger');

    try {
      const health = await readinessCheckHandler({
        db: { ping },
      });

      logger.debug({ health }, 'Health check performed (legacy endpoint)');

      return c.json(health);
    } catch (error) {
      logger.error({ error }, 'Health check failed (legacy endpoint)');

      return c.json(
        {
          status: 'unhealthy',
          timestamp: new Date().toISOString(),
          services: {
            database: {
              status: 'unhealthy',
            },
          },
          error: error instanceof Error ? error.message : 'Unknown error',
        },
        503 // Service Unavailable
      );
    }
  });
