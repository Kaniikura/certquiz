import path from 'node:path';
import { defineProject } from 'vitest/config';
import { baseTestEnv } from './test-env';

export default defineProject({
  test: {
    // Project name - this config is for ALL tests in api
    name: 'api',
    // Global defaults
    globals: true,
    clearMocks: true,
    mockReset: true,
    restoreMocks: true,
    environment: 'node',
    // Use centralized test environment (no duplication)
    env: { ...baseTestEnv },
    // Setup file ensures consistent test isolation
    setupFiles: ['./vitest.setup.ts'],
    // Include all tests by default
    include: ['src/**/*.test.ts', 'tests/**/*.test.ts'],
    exclude: ['**/node_modules/**', '**/dist/**'],
  },
  resolve: {
    alias: {
      '@api': path.resolve(__dirname, './src'),
      '@certquiz/shared': path.resolve(__dirname, '../../packages/shared/src'),
    },
  },
});
