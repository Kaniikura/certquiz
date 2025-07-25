import type { LoggerVariables } from '@api/middleware/logger';
import type { RequestIdVariables } from '@api/middleware/request-id';
import { Hono } from 'hono';
import { livenessCheckHandler, readinessCheckHandler } from './handler';

/**
 * Dependencies for health check routes
 */
interface HealthDeps {
  ping: () => Promise<void>; // Database ping function
  clock: () => Date; // Clock for timestamps
}

/**
 * Health check routes factory
 *
 * Provides two endpoints for system health monitoring:
 * - /live: Liveness probe (lightweight, internal checks)
 * - /ready: Readiness probe (external dependency checks)
 *
 * These endpoints should not require authentication.
 */
export function createHealthRoute(deps: HealthDeps): Hono<{
  Variables: LoggerVariables & RequestIdVariables;
}> {
  const router = new Hono<{
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
            timestamp: deps.clock().toISOString(),
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
          db: { ping: deps.ping },
        });

        // Only log health checks at debug level to reduce noise
        logger.debug({ health }, 'Readiness check performed');

        return c.json(health);
      } catch (error) {
        logger.error({ error }, 'Readiness check failed');

        return c.json(
          {
            status: 'unhealthy',
            timestamp: deps.clock().toISOString(),
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
          db: { ping: deps.ping },
        });

        logger.debug({ health }, 'Health check performed (legacy endpoint)');

        return c.json(health);
      } catch (error) {
        logger.error({ error }, 'Health check failed (legacy endpoint)');

        return c.json(
          {
            status: 'unhealthy',
            timestamp: deps.clock().toISOString(),
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

  return router;
}
