import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Liveness probe response
 * Contains system information and process health
 */
export interface LivenessResponse {
  status: 'healthy';
  service: string;
  version: string;
  environment: string;
  timestamp: string;
  uptime: number;
  memory: {
    heapUsed: number;
    heapTotal: number;
    rss: number;
  };
}

/**
 * Readiness probe response
 * Contains external service connectivity status
 */
export interface ReadinessResponse {
  status: 'healthy' | 'unhealthy';
  timestamp: string;
  services: {
    database: {
      status: 'healthy' | 'unhealthy';
    };
  };
}

/**
 * Liveness check handler
 *
 * Returns process health and system information.
 * This is a lightweight check that doesn't touch external dependencies.
 * Used by orchestrators to determine if the container should be restarted.
 */
export function livenessCheckHandler(): LivenessResponse {
  // Get memory usage
  const { heapUsed, heapTotal, rss } = process.memoryUsage();

  // Get version from package.json
  let version = '0.0.0';
  try {
    const packagePath = join(process.cwd(), 'package.json');
    const packageJson = JSON.parse(readFileSync(packagePath, 'utf-8'));
    version = packageJson.version || '0.0.0';
  } catch {
    // Use default version if package.json not found
  }

  return {
    status: 'healthy',
    service: 'certquiz-api',
    version,
    environment: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: {
      heapUsed,
      heapTotal,
      rss,
    },
  };
}

/**
 * Readiness check handler
 *
 * Checks critical external dependencies.
 * Used by load balancers to determine if the service should receive traffic.
 * The handler accepts dependencies for proper testing.
 */
export async function readinessCheckHandler(deps: {
  db: { ping: () => Promise<boolean> };
}): Promise<ReadinessResponse> {
  // Check database health
  let dbHealthy = false;
  try {
    dbHealthy = await deps.db.ping();
  } catch {
    dbHealthy = false;
  }

  const overallStatus = dbHealthy ? 'healthy' : 'unhealthy';

  return {
    status: overallStatus,
    timestamp: new Date().toISOString(),
    services: {
      database: {
        status: dbHealthy ? 'healthy' : 'unhealthy',
      },
    },
  };
}
