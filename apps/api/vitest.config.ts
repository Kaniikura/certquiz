import { resolve } from 'node:path';
import { defineProject } from 'vitest/config';

export default defineProject({
  // Everything is resolved from the directory that contains this file
  root: __dirname,

  resolve: {
    alias: {
      '@api': resolve(__dirname, '../../apps/api/src'),
      '@api-db': resolve(__dirname, '../../apps/api/src/infra/db'),
      '@shared': resolve(__dirname, '../../packages/shared/src'),
    },
  },

  test: {
    clearMocks: true,
    environment: 'node',
    exclude: ['**/node_modules/**', '**/dist/**'],
    globals: true,

    // Global setup for test database - runs once for all tests
    globalSetup: resolve(__dirname, 'tests/containers/index.ts'),

    // Include all tests by default
    include: [
      'src/**/*.test.ts', // Unit tests co-located with source
      'tests/**/*.test.ts', // Integration tests
    ],

    mockReset: true,
    name: 'api',

    // Pool configuration for transaction isolation
    pool: 'threads',
    poolOptions: {
      threads: {
        singleThread: true, // Run tests sequentially for transaction isolation
      },
    },

    restoreMocks: true,

    // Test timeout for container operations
    // Note: Increase this value on CI if Docker image pulls are slow
    testTimeout: process.env.CI ? 60_000 : 30_000,
  },
});
