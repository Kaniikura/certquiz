import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    clearMocks: true,
    mockReset: true,
    restoreMocks: true,
    env: {
      NODE_ENV: 'test',
      DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
      KEYCLOAK_URL: 'http://localhost:8080',
      KEYCLOAK_REALM: 'test',
      JWT_SECRET: 'test-secret-key-for-testing-purposes',
      BMAC_WEBHOOK_SECRET: 'test-webhook-secret',
      API_PORT: '4000',
      FRONTEND_URL: 'http://localhost:5173',
      REDIS_URL: 'redis://localhost:6379',
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@certquiz/shared': path.resolve(__dirname, '../../packages/shared/src'),
    },
  },
});
