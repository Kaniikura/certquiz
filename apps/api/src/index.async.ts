/**
 * Async Production Entry Point
 * @fileoverview Production server using async DI container for proper async initialization
 */

import { buildAppWithContainer } from './app-factory';
import { createConfiguredContainer } from './infra/di/container-config';
import { getRootLogger } from './infra/logger/root-logger';

// Async entry point now uses async DI container by default

// Create startup logger
const startupLogger = getRootLogger();

// Initialize async app
async function startServer() {
  try {
    // Create and configure async container for production
    const container = createConfiguredContainer('production');

    // Build app with async container
    const app = await buildAppWithContainer(container);

    // Get port configuration
    const port = Number(process.env.API_PORT) || 4000;

    // Log startup info
    startupLogger.info(`🚀 CertQuiz API (async) starting on :${port}`);
    startupLogger.info('📊 Health endpoints:');
    startupLogger.info(`  - Liveness:  http://localhost:${port}/health/live`);
    startupLogger.info(`  - Readiness: http://localhost:${port}/health/ready`);
    startupLogger.info(`  - Legacy:    http://localhost:${port}/health`);

    // Start the server using Bun
    const server = Bun.serve({
      port,
      fetch: app.fetch,
    });

    startupLogger.info(`✅ Server started successfully on port ${server.port}`);
  } catch (error) {
    startupLogger.error('Failed to start server', { error });
    process.exit(1);
  }
}

// Start the server if this is the main module
if (import.meta.main) {
  startServer();
}
