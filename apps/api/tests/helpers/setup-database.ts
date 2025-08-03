/**
 * Database setup utilities for integration tests
 */

import { shutdownDatabase } from '@api/infra/db/client';
import { afterAll, beforeAll } from 'vitest';
import { PostgresSingleton } from '../containers/postgres';
import { createTestDatabase } from './db-core';

/**
 * Sets up a test database for integration tests
 *
 * This function:
 * 1. Creates a new test database with a unique name
 * 2. Runs migrations on the test database
 * 3. Sets DATABASE_URL environment variable
 * 4. Provides cleanup functions in afterAll hook
 *
 * @returns Object with getDatabaseUrl function to retrieve the test database URL
 */
export function setupTestDatabase(): {
  getDatabaseUrl: () => string;
} {
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
