import os from 'node:os';
import { Hono } from 'hono';
import { createLogger } from '../../shared/logger';
import type { AppEnv } from '../../types/app';

const logger = createLogger('health');

/**
 * Get process uptime in seconds
 */
const getUptime = () => Math.floor(process.uptime());

/**
 * Get memory usage statistics
 */
const getMemoryStats = () => {
  const used = process.memoryUsage();
  const total = os.totalmem();

  return {
    used: Math.round(used.heapUsed / 1024 / 1024), // MB
    total: Math.round(total / 1024 / 1024), // MB
    percentage: Math.round((used.heapUsed / total) * 100 * 100) / 100,
  };
};

/**
 * Get CPU information including load averages
 * Note: Instantaneous CPU usage requires time-series data, so we use load averages instead
 */
const getCpuInfo = () => {
  const loadAvg = os.loadavg();
  const cores = os.cpus().length;

  return {
    cores,
    loadAverage: {
      '1min': Math.round(loadAvg[0] * 100) / 100,
      '5min': Math.round(loadAvg[1] * 100) / 100,
      '15min': Math.round(loadAvg[2] * 100) / 100,
    },
    // Load percentage (load average / cores * 100)
    loadPercentage: {
      '1min': Math.round((loadAvg[0] / cores) * 100 * 100) / 100,
      '5min': Math.round((loadAvg[1] / cores) * 100 * 100) / 100,
      '15min': Math.round((loadAvg[2] / cores) * 100 * 100) / 100,
    },
  };
};

interface ServiceHealthCheck {
  status: 'ok' | 'error' | 'degraded';
  latency: number;
  error?: string;
  details?: Record<string, unknown>;
}

/**
 * Check service health with detailed diagnostics
 */
async function checkServiceHealth(
  name: string,
  healthCheck: () => Promise<undefined | Record<string, unknown>>
): Promise<ServiceHealthCheck> {
  const start = Date.now();

  try {
    const result = await healthCheck();
    const latency = Date.now() - start;

    logger.debug({ name, latency }, `Health check for ${name} succeeded`);

    return {
      status: 'ok',
      latency,
      ...(result && { details: result }),
    };
  } catch (error) {
    const latency = Date.now() - start;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    logger.error(
      {
        name,
        latency,
        err: error instanceof Error ? error : new Error(errorMessage),
      },
      `Health check for ${name} failed`
    );

    return {
      status: 'error',
      latency,
      error: errorMessage,
      details: {
        type: error instanceof Error ? error.constructor.name : 'UnknownError',
        ...(error instanceof Error && error.cause ? { cause: String(error.cause) } : {}),
      },
    };
  }
}

export const healthRoutes = new Hono<AppEnv>()
  .get('/', (c) => {
    return c.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: getUptime(),
      version: process.env.npm_package_version || '1.0.0',
    });
  })

  .get('/live', (c) => {
    return c.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
    });
  })

  .get('/ready', async (c) => {
    const cache = c.get('cache');
    const services: Record<string, ServiceHealthCheck> = {};
    let allHealthy = true;
    let hasWarnings = false;

    // Check cache health
    services.cache = await checkServiceHealth('cache', async () => {
      // Ping to check basic connectivity
      const pingResult = await cache.ping();

      return {
        pingResult,
        type: cache.constructor.name,
      };
    });

    if (services.cache.status === 'error') {
      allHealthy = false;
    }

    // Check Database health (placeholder for now)
    services.database = {
      status: 'degraded', // Use 'degraded' until check is implemented
      latency: 0,
      details: {
        note: 'Database health check not yet implemented',
      },
    };
    hasWarnings = true; // Mark that there are warnings

    // Determine overall status
    const overallStatus = allHealthy ? (hasWarnings ? 'degraded' : 'ok') : 'error';

    // Set appropriate status code
    const statusCode = allHealthy ? 200 : 503;

    return c.json(
      {
        status: overallStatus,
        timestamp: new Date().toISOString(),
        services,
        details: {
          healthy: allHealthy,
          degraded: hasWarnings,
          uptime: getUptime(),
        },
      },
      statusCode
    );
  })

  .get('/metrics', async (c) => {
    const cache = c.get('cache');
    const metrics: Record<string, unknown> = {
      uptime: getUptime(),
      memory: getMemoryStats(),
      cpu: getCpuInfo(),
      system: {
        platform: os.platform(),
        release: os.release(),
        architecture: os.arch(),
      },
    };

    // Collect cache metrics
    try {
      const pingResult = await cache.ping();
      metrics.cache = {
        connected: true,
        type: cache.constructor.name,
        healthy: pingResult === 'PONG',
      };
    } catch (error) {
      logger.error(
        {
          err: error as Error,
          operation: 'cache_metrics_collection',
          context: 'health_metrics_endpoint',
        },
        'Error fetching cache metrics'
      );
      metrics.cache = {
        connected: false,
        type: cache.constructor.name,
        error: error instanceof Error ? error.message : 'Failed to fetch metrics',
        errorType: error instanceof Error ? error.constructor.name : 'UnknownError',
      };
    }

    return c.json(metrics);
  });
