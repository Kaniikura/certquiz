import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, loadEnv } from 'vite';
import tsconfigPaths from 'vite-tsconfig-paths';

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig(({ mode }) => ({
  root: __dirname,
  plugins: [tsconfigPaths()],

  // API-specific cache directory
  cacheDir: '.vitest_cache',

  test: {
    // Load all environment variables (not just VITE_* prefixed ones)
    env: loadEnv(mode ?? 'test', __dirname, ''),
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
      'test-utils/**/*.test.ts', // Test utilities verification tests
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
  },
}));
