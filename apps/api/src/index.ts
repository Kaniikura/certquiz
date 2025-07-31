import { buildApp } from './app-factory';
import { PremiumAccessService } from './features/question/domain';
import { createAuthProvider } from './infra/auth/AuthProviderFactory.prod';
import { getDb, ping } from './infra/db/client';
import { DrizzleDatabaseContext } from './infra/db/DrizzleDatabaseContext';
import { DrizzleUnitOfWorkProvider } from './infra/db/DrizzleUnitOfWorkProvider';
import { getRootLogger } from './infra/logger/root-logger';
import { SystemClock } from './shared/clock';
import { CryptoIdGenerator } from './shared/id-generator';

// Create production dependencies
const logger = getRootLogger();
const authProvider = createAuthProvider();
const idGenerator = new CryptoIdGenerator();
const premiumAccessService = new PremiumAccessService();
const clock = new SystemClock();
const unitOfWorkProvider = new DrizzleUnitOfWorkProvider(logger);
const db = getDb();
const databaseContext = new DrizzleDatabaseContext(logger, unitOfWorkProvider, db);

// Build production app with real dependencies
export const app = buildApp({
  logger,
  clock,
  idGenerator,
  ping,
  premiumAccessService,
  authProvider,
  databaseContext,
});

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
