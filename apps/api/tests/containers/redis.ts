import { GenericContainer, type StartedTestContainer } from 'testcontainers';

// Module-level variables for singleton pattern
let instance: StartedTestContainer | undefined;
let instancePromise: Promise<StartedTestContainer> | undefined;

/**
 * Get or create the Redis container instance.
 * Container is reused across test runs for performance.
 */
async function getInstance(): Promise<StartedTestContainer> {
  // If we're already starting the container, return that promise
  if (instancePromise) return instancePromise;
  if (instance) return instance;

  instancePromise = (async () => {
    const container = await new GenericContainer('redis:7-alpine')
      .withExposedPorts(6379)
      .withReuse() // Reuse container across test runs
      .withCommand(['redis-server', '--appendonly', 'no']) // Disable persistence for tests
      .start();

    instance = container;
    instancePromise = undefined; // Clear the promise reference
    return container;
  })();

  return instancePromise;
}

/**
 * Redis test container singleton.
 * Provides a shared Redis instance across all integration tests.
 */
export const RedisSingleton = {
  getInstance,

  /**
   * Get the connection URL for the Redis instance.
   * Returns a properly formatted Redis URL with the mapped port.
   */
  async getConnectionUrl(): Promise<string> {
    const container = await getInstance();
    const host = container.getHost();
    const port = container.getMappedPort(6379);
    return `redis://${host}:${port}`;
  },

  /**
   * Clear all data in Redis.
   * Useful for test isolation without restarting the container.
   */
  async flushAll(): Promise<void> {
    const container = await getInstance();
    const result = await container.exec(['redis-cli', 'FLUSHALL']);

    if (result.exitCode !== 0) {
      throw new Error(`Failed to flush Redis: ${result.stderr}`);
    }
  },
};

// Export type for convenience
export type { StartedTestContainer };
