import { Hono } from 'hono';
import type { AppEnv } from '../types/app';
import type { RedisClientType } from 'redis';
import os from 'node:os';
import { createLogger } from '../lib/logger';

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
  details?: Record<string, any>;
}

/**
 * Check service health with detailed diagnostics
 */
async function checkServiceHealth(
  name: string,
  healthCheck: () => Promise<undefined | Record<string, any>>
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
    const redis = c.get('redis');
    const services: Record<string, ServiceHealthCheck> = {};
    let allHealthy = true;
    let hasWarnings = false;

    // Check Redis health with detailed diagnostics
    if (redis) {
      services.redis = await checkServiceHealth('redis', async () => {
        const redisClient = redis as RedisClientType;

        // Ping to check basic connectivity
        const pingResult = await redisClient.ping();

        // Get additional Redis info
        const [clientInfo, memoryInfo] = await Promise.all([
          redisClient.info('clients'),
          redisClient.info('memory'),
        ]);

        // Parse connected clients
        const connectedMatch = clientInfo.match(/connected_clients:(\d+)/);
        const connectedClients = connectedMatch ? parseInt(connectedMatch[1], 10) : 0;

        // Parse memory usage
        const memoryMatch = memoryInfo.match(/used_memory_human:([^\r\n]+)/);
        const memoryUsage = memoryMatch ? memoryMatch[1] : 'unknown';

        // Check for degraded state (high connection count)
        if (connectedClients > 100) {
          hasWarnings = true;
          return {
            warning: 'High connection count',
            connectedClients,
            memoryUsage,
            pingResult,
          };
        }

        return {
          connectedClients,
          memoryUsage,
          pingResult,
        };
      });

      if (services.redis.status === 'error') {
        allHealthy = false;
      }
    } else {
      services.redis = {
        status: 'error',
        latency: 0,
        error: 'Redis client not initialized',
      };
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
    const redis = c.get('redis');
    const metrics: Record<string, any> = {
      uptime: getUptime(),
      memory: getMemoryStats(),
      cpu: getCpuInfo(),
      system: {
        platform: os.platform(),
        release: os.release(),
        architecture: os.arch(),
      },
    };

    // Collect Redis metrics if available
    if (redis) {
      try {
        const redisClient = redis as RedisClientType;
        const [clientInfo, memoryInfo, statsInfo] = await Promise.all([
          redisClient.info('clients'),
          redisClient.info('memory'),
          redisClient.info('stats'),
        ]);

        // Parse Redis metrics
        const parseMetric = (info: string, pattern: RegExp): string | number => {
          const match = info.match(pattern);
          if (!match) return 0;
          const value = match[1];
          return Number.isNaN(Number(value)) ? value : Number(value);
        };

        metrics.redis = {
          connected: true,
          connections: {
            current: parseMetric(clientInfo, /connected_clients:(\d+)/),
            blocked: parseMetric(clientInfo, /blocked_clients:(\d+)/),
            maxClients: parseMetric(clientInfo, /maxclients:(\d+)/),
          },
          memory: {
            used: parseMetric(memoryInfo, /used_memory:(\d+)/),
            peak: parseMetric(memoryInfo, /used_memory_peak:(\d+)/),
            rss: parseMetric(memoryInfo, /used_memory_rss:(\d+)/),
            overhead: parseMetric(memoryInfo, /used_memory_overhead:(\d+)/),
            fragmentation: parseMetric(memoryInfo, /mem_fragmentation_ratio:([0-9.]+)/),
          },
          stats: {
            totalCommands: parseMetric(statsInfo, /total_commands_processed:(\d+)/),
            instantaneousOps: parseMetric(statsInfo, /instantaneous_ops_per_sec:(\d+)/),
            rejectedConnections: parseMetric(statsInfo, /rejected_connections:(\d+)/),
            expiredKeys: parseMetric(statsInfo, /expired_keys:(\d+)/),
            evictedKeys: parseMetric(statsInfo, /evicted_keys:(\d+)/),
          },
        };
      } catch (error) {
        logger.error(
          {
            err: error as Error,
            operation: 'redis_metrics_collection',
            context: 'health_metrics_endpoint',
          },
          'Error fetching Redis metrics'
        );
        metrics.redis = {
          connected: false,
          error: error instanceof Error ? error.message : 'Failed to fetch metrics',
          errorType: error instanceof Error ? error.constructor.name : 'UnknownError',
        };
      }
    } else {
      metrics.redis = {
        connected: false,
        error: 'Redis client not initialized',
      };
    }

    return c.json(metrics);
  });
