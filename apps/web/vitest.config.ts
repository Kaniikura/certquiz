import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.{test,spec}.{js,ts}'],
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    alias: {
      $lib: resolve(__dirname, './src/lib'),
      '$app/environment': resolve(__dirname, './src/test/mocks/app-environment.ts'),
      '$app/stores': resolve(__dirname, './src/test/mocks/app-stores.ts'),
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'src/test/',
        '*.config.ts',
        '*.config.js',
        'src/**/*.test.ts',
        'src/**/*.spec.ts',
        '.svelte-kit/**',
        'tests/**',
        'src/routes/**/*.svelte',
        'src/app.d.ts',
        'src/lib/index.ts',
      ],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80,
      },
    },
  },
  resolve: {
    alias: {
      $lib: resolve(__dirname, './src/lib'),
      '$app/environment': resolve(__dirname, './src/test/mocks/app-environment.ts'),
      '$app/stores': resolve(__dirname, './src/test/mocks/app-stores.ts'),
    },
  },
});
