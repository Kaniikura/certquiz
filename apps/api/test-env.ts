/**
 * Base test environment variables used across all tests
 * This is the canonical definition - modify here when adding new env vars
 */
export const baseTestEnv = {
  API_PORT: '4000',
  BMAC_WEBHOOK_SECRET: 'test-webhook-secret',
  DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
  FRONTEND_URL: 'http://localhost:5173',
  JWT_SECRET: 'test-secret-key-for-testing-purposes',
  KEYCLOAK_REALM: 'test',
  KEYCLOAK_URL: 'http://localhost:8080',
  NODE_ENV: 'test',
} as const;

/**
 * Minimal valid environment for env validation tests
 */
export const validEnvForTests = {
  BMAC_WEBHOOK_SECRET: 'test-webhook-secret',
  DATABASE_URL: 'postgresql://postgres:password@localhost:5432/certquiz',
  JWT_SECRET: 'test-secret-key-with-minimum-length',
  KEYCLOAK_REALM: 'certquiz',
  KEYCLOAK_URL: 'http://localhost:8080',
} as const;

/**
 * Utility for running code with temporary environment overrides
 */
export async function withEnv<T>(
  overrides: NodeJS.ProcessEnv,
  fn: () => T | Promise<T>
): Promise<T> {
  const old = { ...process.env };
  try {
    Object.assign(process.env, overrides);
    return await fn();
  } finally {
    process.env = old;
  }
}
