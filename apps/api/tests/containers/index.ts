// Set environment variables BEFORE importing testcontainers modules
// This ensures Ryuk is disabled for Bun compatibility
if (typeof Bun !== 'undefined' || process.versions.bun) {
  process.env.TESTCONTAINERS_RYUK_DISABLED ??= 'true';
}

import { getPostgres } from './postgres';

/**
 * Global setup function for Vitest.
 * Starts all required containers for integration/e2e tests.
 */
export async function setup() {
  // Skip container setup for unit tests
  const testType = process.env.TEST_TYPE || '';
  if (testType === 'unit') {
    return;
  }

  // Start PostgreSQL container
  const postgresContainer = await getPostgres();

  // Get connection URL
  const postgresUrl = postgresContainer.getConnectionUri();

  // Set environment variables for the test run
  process.env.DATABASE_URL_TEST = postgresUrl;
  process.env.DATABASE_URL = postgresUrl; // Some tests might use DATABASE_URL
}

/**
 * Global teardown function for Vitest.
 * Currently no-op as containers with .withReuse() persist between runs.
 */
export async function teardown() {
  // Containers with .withReuse() are kept running for faster subsequent test runs
  // They will be automatically cleaned up by Testcontainers/Docker when no longer needed
}

// Export utilities for direct use in tests
export { getPostgres, PostgresSingleton } from './postgres';
