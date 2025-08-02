import { buildAppWithContainer } from './app-factory';
import { createConfiguredContainer } from './infra/di/container-config';
import { getRootLogger } from './infra/logger/root-logger';

// Create production app using unified container architecture
const container = createConfiguredContainer('production');
export const app = await buildAppWithContainer(container);

// -----------------------------------------------------------------
// Bun automatically starts the server when it sees this default export
// with { port?, fetch } shape. No explicit Bun.serve() needed!
// -----------------------------------------------------------------
const port = Number(process.env.API_PORT) || 4000;

// Create startup logger using centralized factory
const startupLogger = getRootLogger();

// Log startup info when running as main module
if (import.meta.main) {
  startupLogger.info(`🚀 CertQuiz API listening on :${port}`);
  startupLogger.info('📊 Health endpoints:');
  startupLogger.info(`  - Liveness:  http://localhost:${port}/health/live`);
  startupLogger.info(`  - Readiness: http://localhost:${port}/health/ready`);
  startupLogger.info(`  - Legacy:    http://localhost:${port}/health`);
}

// Bun recognizes this export shape and starts the server automatically
export default {
  port,
  fetch: app.fetch,
};
