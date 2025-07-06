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

    // Check Database health (placeholder for now)
    services.database = {
      status: 'degraded', // Use 'degraded' until check is implemented
      latency: 0,
      details: {
        note: 'Database health check not yet implemented',
      },
    };

    // Dynamically calculate health status from all services
    const serviceStatuses = Object.values(services);
    const allHealthy = serviceStatuses.every((s) => s.status === 'ok');
    const hasErrors = serviceStatuses.some((s) => s.status === 'error');
    const hasDegraded = serviceStatuses.some((s) => s.status === 'degraded');

    // Determine overall status based on actual service states
    const overallStatus = hasErrors ? 'error' : hasDegraded ? 'degraded' : 'ok';

    // Set appropriate status code (503 for errors, 200 otherwise)
    const statusCode = hasErrors ? 503 : 200;

    return c.json(
      {
        status: overallStatus,
        timestamp: new Date().toISOString(),
        services,
        details: {
          healthy: allHealthy,
          degraded: hasDegraded,
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
