import os from 'node:os';
import type { AppEnv } from '@api/types/app';
import { Hono } from 'hono';

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
    const services: Record<string, ServiceHealthCheck> = {};
    const allHealthy = true;
    const hasWarnings = true;

    // Check Database health (placeholder for now)
    services.database = {
      status: 'degraded', // Use 'degraded' until check is implemented
      latency: 0,
      details: {
        note: 'Database health check not yet implemented',
      },
    };

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

    return c.json(metrics);
  });
