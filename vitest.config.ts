import tsconfigPaths from 'vite-tsconfig-paths';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [tsconfigPaths()],

  // Global options that apply to all projects
  cacheDir: '.vitest_cache',
  test: {
    // Coverage and reporters can only be configured at root level
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
    },
    reporters: ['default'],

    // Use forks pool to ensure single container set across all tests
    pool: 'forks',

    // Define non-overlapping projects only (to avoid test duplication)
    projects: [
      // --------------- API Projects (scoped) -----------------
      // API - Unit tests only
      {
        root: './apps/api',
        extends: true,
        test: {
          name: 'api-unit',
          include: ['src/**/*.test.ts'],
          exclude: ['**/node_modules/**', '**/dist/**'],
          setupFiles: ['./vitest.setup.ts'],
          env: {
            TEST_TYPE: 'unit',
            CACHE_DRIVER: 'memory', // Unit tests use memory cache
          },
        },
      },

      // API - Integration tests only
      {
        root: './apps/api',
        extends: true,
        test: {
          name: 'api-integration',
          include: ['tests/integration/**/*.test.ts'],
          testTimeout: 30_000,
          setupFiles: ['./vitest.setup.ts'],
          globalSetup: ['./tests/containers/index.ts'], // Container setup for integration tests
          env: {
            TEST_TYPE: 'integration',
            // CACHE_DRIVER will be set to 'redis' by global setup
          },
        },
      },

      // API - E2E tests only
      {
        root: './apps/api',
        extends: true,
        test: {
          name: 'api-e2e',
          include: ['tests/e2e/**/*.test.ts'],
          testTimeout: 120_000,
          setupFiles: ['./vitest.setup.ts'],
          globalSetup: ['./tests/containers/index.ts'], // Container setup for e2e tests
          env: {
            TEST_TYPE: 'e2e',
            // CACHE_DRIVER will be set to 'redis' by global setup
          },
        },
      },

      // --------------- Future Projects -----------------
      // 'apps/web',
      // 'packages/*',
    ],
  },
});
