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
          exclude: ['**/node_modules/**', '**/dist/**', '**/*.integration.test.ts'],
          setupFiles: [
            './tests/setup/vitest.shared.setup.ts',
            './tests/setup/vitest.unit.setup.ts',
          ],
          unstubEnvs: true, // Automatically restore env vars after each test
          env: {
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
          include: ['tests/integration/**/*.test.ts', 'src/**/*.integration.test.ts'],
          setupFiles: [
            './tests/setup/vitest.shared.setup.ts',
            './tests/setup/vitest.integration.setup.ts',
          ],
          globalSetup: ['./tests/containers/index.ts'], // Container setup for integration tests
          pool: 'forks',
          poolOptions: {
            forks: {
              singleFork: true, // Single process to avoid container conflicts
            },
          },
          // Note: testTimeout is set in vitest.integration.setup.ts
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
          setupFiles: [
            './tests/setup/vitest.shared.setup.ts',
            './tests/setup/vitest.integration.setup.ts', // E2E uses same setup as integration
          ],
          globalSetup: ['./tests/containers/index.ts'], // Container setup for e2e tests
          pool: 'forks',
          poolOptions: {
            forks: {
              singleFork: true, // Single process to avoid container conflicts
            },
          },
        },
      },

      // --------------- Future Projects -----------------
      // 'apps/web',
      // 'packages/*',
    ],
  },
});
