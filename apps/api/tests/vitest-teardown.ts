/**
 * Vitest teardown setup
 * Ensures proper cleanup after all tests complete
 */

import { afterAll } from 'vitest';
import { shutdownDatabase } from '../src/infra/db/client';

// Global teardown to ensure database connections are closed
afterAll(async () => {
  await shutdownDatabase();
});
