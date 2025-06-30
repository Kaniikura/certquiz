import { defineProject } from 'vitest/config';
import { baseTestEnv } from './test-env';

export default defineProject({
  test: {
    clearMocks: true,
    // Use centralized test environment (no duplication)
    env: { ...baseTestEnv },
    environment: 'node',
    exclude: ['**/node_modules/**', '**/dist/**'],
    // Global defaults
    globals: true,
    // Include all tests by default
    include: ['src/**/*.test.ts', 'tests/**/*.test.ts'],
    mockReset: true,
    // Project name - this config is for ALL tests in api
    name: 'api',
    restoreMocks: true,
    // Setup file ensures consistent test isolation
    setupFiles: ['./vitest.setup.ts'],
  },
});
