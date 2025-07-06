import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export interface HealthCheckResponse {
  status: 'healthy' | 'unhealthy';
  service: string;
  timestamp: string;
  version: string;
  environment: string;
  uptime: number;
  memory: {
    heapUsed: number;
    heapTotal: number;
    rss: number;
  };
}

/**
 * Health check handler for system monitoring
 *
 * Returns current system status including version, environment,
 * uptime, and memory usage. This is a pure function that doesn't
 * require any external dependencies.
 */
export async function healthCheckHandler(): Promise<HealthCheckResponse> {
  // Get version from package.json
  let version = '0.0.0';
  try {
    const packagePath = join(process.cwd(), 'package.json');
    const packageJson = JSON.parse(readFileSync(packagePath, 'utf-8'));
    version = packageJson.version || '0.0.0';
  } catch {
    // Use default version if package.json not found
  }

  // Get memory usage
  const memoryUsage = process.memoryUsage();

  return {
    status: 'healthy',
    service: 'certquiz-api',
    timestamp: new Date().toISOString(),
    version,
    environment: process.env.NODE_ENV || 'development',
    uptime: process.uptime(),
    memory: {
      heapUsed: memoryUsage.heapUsed,
      heapTotal: memoryUsage.heapTotal,
      rss: memoryUsage.rss,
    },
  };
}
