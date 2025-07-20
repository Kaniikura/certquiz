/**
 * Vitest teardown setup
 * Ensures proper cleanup after all tests complete
 */

import { shutdownDatabase } from '@api/infra/db/client';
import { afterAll } from 'vitest';

// Global teardown to ensure database connections are closed
afterAll(async () => {
  await shutdownDatabase();
});
