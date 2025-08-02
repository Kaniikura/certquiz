/**
 * Vitest teardown setup
 * Ensures proper cleanup after all tests complete
 */

import { shutdownDatabase } from '@api/infra/db/client';
import { cleanupWorkerDatabases } from '@test/helpers/database';
import { afterAll } from 'vitest';

// Global teardown to ensure database connections are closed
afterAll(async () => {
  // Clean up per-worker test databases
  await cleanupWorkerDatabases();

  // Shutdown main database connections
  await shutdownDatabase();
});
