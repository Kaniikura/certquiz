/**
 * Vitest configuration for integration and E2E tests
 *
 * This configuration runs integration tests sequentially to prevent database
 * conflicts when multiple test files try to access the shared testcontainer.
 *
 * Parallel execution is disabled for the following reasons:
 * 1. Database Resource Contention: Multiple test files accessing the same PostgreSQL
 *    testcontainer can cause resource conflicts and connection issues
 * 2. CI Environment Limitations: CI environments have limited resources and parallel
 *    execution often leads to timeouts in PostgresSingleton.getInstance()
 * 3. Test Isolation: Sequential execution ensures proper test isolation and
 *    prevents flaky test failures due to concurrent database operations
 * 4. Consistency: Same behavior in both local and CI environments reduces
 *    environment-specific issues and debugging complexity
 *
 * Key differences from unit tests:
 * - Sequential execution (fileParallelism: false, singleFork: true)
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

      // Run tests sequentially to prevent database conflicts
      // when multiple test files try to access the shared testcontainer.
      // Parallel execution causes resource contention and CI timeouts.
      poolOptions: {
        forks: {
          singleFork: true, // Always run sequentially - no environment-specific behavior
        },
      },

      // Disable file parallelism to ensure database isolation.
      // This prevents flaky test failures and ensures consistent behavior
      // across local development and CI environments.
      fileParallelism: false,

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
