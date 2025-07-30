/**
 * Integration test helpers
 * @fileoverview Shared utilities for setting up isolated test databases in integration tests
 */

import { shutdownDatabase } from '@api/infra/db/client';
import { createTestDatabase } from '@api/testing/infra/db';
import { afterAll, beforeAll } from 'vitest';
import { PostgresSingleton } from '../../tests/containers';

/**
 * Setup isolated test database for integration tests
 *
 * While this function is still necessary for database isolation in integration tests,
 * use the unified test app factory pattern from `@api/tests/setup/test-app-factory`
 * instead of manual app setup. This function remains for database lifecycle management.
 *
 * This helper encapsulates the common pattern used across integration tests:
 * 1. Creates an isolated PostgreSQL database using test containers
 * 2. Runs migrations on the test database
 * 3. Sets DATABASE_URL environment variable
 * 4. Provides cleanup function for afterAll hook
 *
 * @example
 * ```typescript
 * // Use test app factory with DI container
 * import { createIntegrationTestApp } from '@api/tests/setup/test-app-factory';
 * import { setupTestDatabase } from '@api/testing/domain';
 *
 * describe('My Integration Test', () => {
 *   setupTestDatabase(); // Still needed for database isolation
 *
 *   let testApp: TestApp;
 *   beforeEach(() => {
 *     testApp = createIntegrationTestApp(); // Use DI-based factory
 *   });
 *
 *   it('should work with isolated database', async () => {
 *     const response = await testApp.request('/health');
 *     expect(response.status).toBe(200);
 *   });
 * });
 * ```
 */
export function setupTestDatabase() {
  let dbUrl: string;
  let cleanup: () => Promise<void>;

  beforeAll(async () => {
    const container = await PostgresSingleton.getInstance();
    const result = await createTestDatabase({
      root: container.getConnectionUri(),
      migrate: true,
    });
    dbUrl = result.url;
    cleanup = result.drop;

    // Set DATABASE_URL for the application
    process.env.DATABASE_URL = dbUrl;
  }, 30000); // 30 second timeout for database setup

  afterAll(async () => {
    // Shutdown database connections first
    await shutdownDatabase();

    // Then drop the test database
    if (cleanup) {
      await cleanup();
    }
  }, 30000); // 30 second timeout for cleanup

  return {
    /**
     * Get the test database URL
     * Note: Only available after beforeAll hook has run
     */
    getDatabaseUrl: () => dbUrl,
  };
}
