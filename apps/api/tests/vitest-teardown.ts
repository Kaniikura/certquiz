/**
 * Vitest teardown setup
 * Ensures proper cleanup after all tests complete
 */

import { shutdownDatabase } from '@api/infra/db/client';
import { closeAllTrackedClients } from '@api/test-support/db/TestDatabaseFactory';
import { afterAll } from 'vitest';

// Global teardown to ensure database connections are closed
afterAll(async () => {
  // Close all tracked test database clients
  await closeAllTrackedClients();

  // Shutdown main database connections
  await shutdownDatabase();
});
