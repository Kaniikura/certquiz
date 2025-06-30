import { PostgresSingleton } from './postgres';
import { RedisSingleton } from './redis';

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
  // Start containers in parallel for faster startup
  const [postgresContainer, _redisContainer] = await Promise.all([
    PostgresSingleton.getInstance(),
    RedisSingleton.getInstance(),
  ]);

  // Get connection URLs
  const postgresUrl = postgresContainer.getConnectionUri();
  const redisUrl = await RedisSingleton.getConnectionUrl();

  // Set environment variables for the test run
  process.env.DATABASE_URL_TEST = postgresUrl;
  process.env.DATABASE_URL = postgresUrl; // Some tests might use DATABASE_URL
  process.env.REDIS_URL = redisUrl;

  // Set cache driver to Redis for integration tests
  process.env.CACHE_DRIVER = 'redis';
}

/**
 * Global teardown function for Vitest.
 * Currently no-op as containers with .withReuse() persist between runs.
 */
export async function teardown() {
  // Containers with .withReuse() are kept running for faster subsequent test runs
  // They will be automatically cleaned up by Testcontainers/Docker when no longer needed
}

// Export singletons for direct use in tests
export { PostgresSingleton, RedisSingleton };
