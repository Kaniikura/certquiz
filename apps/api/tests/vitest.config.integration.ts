/**
 * Vitest configuration for integration and E2E tests
 *
 * This configuration uses conservative parallelization to balance performance
 * with stability by limiting concurrent test files while maintaining database isolation.
 *
 * Execution strategy:
 * - Limited parallel execution (maxForks: 2) to prevent resource contention
 * - Each test file creates isolated databases via setupTestDatabase()
 * - File parallelism enabled with controlled concurrency
 * - Maintains stability while improving performance over sequential execution
 *
 * Benefits:
 * - Improved execution speed compared to fully sequential execution
 * - Database isolation maintained through setupTestDatabase() per test file
 * - Reduced resource contention through limited concurrency
 * - Better CI performance while maintaining test reliability
 *
 * Key differences from unit tests:
 * - Limited fork parallelism (maxForks: 2) instead of single fork
 * - File parallelism enabled for better performance
 * - Longer timeouts for database operations
 * - Includes integration-specific setup files
 * - Only includes *.integration.test.ts and e2e test files
 */

import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, loadEnv } from 'vite';
import tsconfigPaths from 'vite-tsconfig-paths';
import { mapTestEnvironmentVariables } from '../testing/infra/vitest';

// Get root directory path
const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..'); // Go up one level to api directory

export default defineConfig(({ mode }) => {
  // Load only TEST_* prefixed environment variables
  const testEnv = loadEnv(mode ?? 'integration', rootDir, 'TEST_');

  // Map TEST_* variables to their expected names for the application code
  const mappedEnv = mapTestEnvironmentVariables(testEnv);
  Object.assign(process.env, mappedEnv);

  return {
    root: rootDir,
    plugins: [tsconfigPaths()],

    // API-specific cache directory
    cacheDir: '.vitest_cache',

    test: {
      // Pass the TEST_* prefixed environment variables to Vitest
      env: testEnv,
      // Coverage and reporters for API app
      coverage: {
        provider: 'v8',
        reporter: ['text', 'lcov'],
        reportsDirectory: './coverage',
      },
      reporters: ['default'],

      // Use forks pool to ensure proper container management
      pool: 'forks',

      // Conservative parallelization: Limited concurrent test files to balance
      // performance with stability. Each test file manages database isolation
      // through setupTestDatabase(), but we limit concurrency to prevent
      // resource contention and environment variable conflicts
      poolOptions: {
        forks: {
          // Limit to 2 concurrent forks to reduce resource contention
          // while still providing performance benefits over sequential execution
          maxForks: 2,
          minForks: 1,
        },
      },

      // Enable limited file parallelism for improved test execution speed
      // while maintaining database isolation through setupTestDatabase()
      fileParallelism: true,

      // Only include integration tests
      include: [
        'src/**/*.integration.test.ts',
        'tests/integration/**/*.test.ts',
        'tests/e2e/**/*.test.ts',
      ],

      // Setup files for integration tests
      setupFiles: [
        './tests/setup/vitest.shared.setup.ts',
        './tests/setup/vitest.integration.setup.ts',
        './tests/vitest-teardown.ts',
      ],

      // Global test configuration
      clearMocks: true,
      environment: 'node',
      exclude: ['**/node_modules/**', '**/dist/**'],
      globals: true,
      mockReset: true,
      restoreMocks: true,

      // Longer timeout for integration tests (45 seconds)
      // Uses a unified timeout for consistency across all environments
      // instead of environment-specific timeouts
      testTimeout: 45_000,
    },
  };
});
