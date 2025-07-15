import { buildProductionApp } from './app-factory';
import { getRootLogger } from './infra/logger/root-logger';

// Build production app with real dependencies
export const app = await buildProductionApp();

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
