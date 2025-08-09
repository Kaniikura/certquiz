import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, loadEnv } from 'vite';
import tsconfigPaths from 'vite-tsconfig-paths';
import { mapTestEnvironmentVariables } from './tests/helpers/env';

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig(({ mode }) => {
  // Load only TEST_* prefixed environment variables
  // Use 'test' as fallback when mode is undefined, which loads .env.test files
  // This is appropriate for the main test configuration targeting unit tests
  const testEnv = loadEnv(mode ?? 'test', __dirname, 'TEST_');

  // Map TEST_* variables to their expected names for the application code
  const mappedEnv = mapTestEnvironmentVariables(testEnv);
  Object.assign(process.env, mappedEnv);

  return {
    root: __dirname,
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

      // Include all tests by default (sophisticated patterns preserved via include/exclude)
      include: [
        'src/**/*.test.ts', // Unit tests co-located with source
        'tests/**/*.test.ts', // Integration and E2E tests
      ],

      // Setup files for database cleanup (from our working solution)
      setupFiles: ['./tests/setup/vitest.shared.setup.ts', './tests/vitest-teardown.ts'],

      // Global test configuration
      clearMocks: true,
      environment: 'node',
      exclude: ['**/node_modules/**', '**/dist/**'],
      globals: true,
      mockReset: true,
      restoreMocks: true,

      // Default timeout for non-project tests and fallback
      testTimeout: process.env.CI ? 60_000 : 30_000,

      // Force vitest to inline jose module to handle ES Module imports
      server: {
        deps: {
          inline: ['jose'],
        },
      },
    },
  };
});
