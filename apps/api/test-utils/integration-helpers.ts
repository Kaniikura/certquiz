/**
 * Integration test helpers
 * @fileoverview Shared utilities for setting up isolated test databases in integration tests
 */

import { shutdownDatabase } from '@api/infra/db/client';
import type { LoggerVariables, RequestIdVariables } from '@api/middleware';
import { createTestDatabase } from '@api/test-utils/db';
import type { Hono } from 'hono';
import { afterAll, beforeAll } from 'vitest';
import { PostgresSingleton } from '../tests/containers';

/**
 * Setup isolated test database for integration tests
 *
 * This helper encapsulates the common pattern used across integration tests:
 * 1. Creates an isolated PostgreSQL database using test containers
 * 2. Runs migrations on the test database
 * 3. Sets DATABASE_URL environment variable
 * 4. Provides cleanup function for afterAll hook
 *
 * @example
 * ```typescript
 * import { setupTestDatabase } from '@api/test-utils/integration-helpers';
 *
 * describe('My Integration Test', () => {
 *   const { getDatabaseUrl } = setupTestDatabase();
 *
 *   it('should work with isolated database', async () => {
 *     // Your test code here
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
  });

  afterAll(async () => {
    // Shutdown database connections first
    await shutdownDatabase();

    // Then drop the test database
    if (cleanup) {
      await cleanup();
    }
  });

  return {
    /**
     * Get the test database URL
     * Note: Only available after beforeAll hook has run
     */
    getDatabaseUrl: () => dbUrl,
  };
}

/**
 * Create an isolated app instance for integration tests
 *
 * This creates a new app instance that will use the test database
 * set up by setupTestDatabase(). The app is created lazily to ensure
 * the DATABASE_URL has been set by the beforeAll hook.
 *
 * @example
 * ```typescript
 * import { setupTestDatabase, createTestApp } from '@api/test-utils/integration-helpers';
 * import { app } from '@api/index';
 *
 * describe('My Integration Test', () => {
 *   setupTestDatabase();
 *   const testApp = createTestApp(app);
 *
 *   it('should handle requests', async () => {
 *     const response = await testApp.request('/health');
 *     expect(response.status).toBe(200);
 *   });
 * });
 * ```
 */
// Type alias for the app type used in this project
export type AppType = Hono<{
  Variables: LoggerVariables & RequestIdVariables;
}>;

export function createTestApp(app: AppType): AppType {
  // Simply return the app instance passed in
  // The test file is responsible for importing the app
  return app;
}
