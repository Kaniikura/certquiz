// Set environment variables BEFORE importing testcontainers modules
// This ensures Ryuk is disabled for Bun compatibility
if (typeof Bun !== 'undefined' || process.versions.bun) {
  process.env.TESTCONTAINERS_RYUK_DISABLED ??= 'true';
}

import { getPostgres, PostgresSingleton } from './postgres';

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
 * Ensures containers are properly stopped in CI environments.
 */
export async function teardown() {
  // Only stop containers in CI to ensure cleanup
  // In local dev, let them persist for faster subsequent runs
  if (process.env.CI === 'true') {
    console.log('🧹 CI environment detected - stopping test containers...');

    try {
      await PostgresSingleton.stop();
      console.log('✅ Test containers stopped successfully');
    } catch (_error) {
      // Container might not have been started, which is fine
      console.log('ℹ️  No containers to stop or already stopped');
    }
  } else {
    console.log('💡 Local environment - keeping containers for faster reruns');
    console.log('   Run "bun run test:cleanup" to remove reusable containers');
  }
}

// Export utilities for direct use in tests
export { getPostgres, PostgresSingleton } from './postgres';
