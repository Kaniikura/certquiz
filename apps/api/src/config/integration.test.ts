import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { env } from './env';

describe('Environment Configuration Integration', () => {
  const originalEnv = { ...process.env };

  beforeAll(() => {
    // Set up test environment variables
    process.env.DATABASE_URL = 'postgresql://postgres:password@localhost:5432/certquiz_test';
    process.env.KEYCLOAK_URL = 'http://localhost:8080';
    process.env.KEYCLOAK_REALM = 'certquiz';
    process.env.JWT_SECRET = 'test-secret-key-with-minimum-length';
    process.env.BMAC_WEBHOOK_SECRET = 'test-webhook-secret';
    process.env.API_PORT = '4000';
    process.env.NODE_ENV = 'test';
    process.env.FRONTEND_URL = 'http://localhost:5173';
  });

  afterAll(() => {
    // Restore original environment
    process.env = originalEnv;
  });

  it('should load environment variables through proxy', () => {
    // Test that env proxy provides access to all required variables
    expect(env.DATABASE_URL).toBeDefined();
    expect(env.DATABASE_URL).toMatch(/^postgresql:\/\//);

    expect(env.KEYCLOAK_URL).toBeDefined();
    expect(env.KEYCLOAK_URL).toMatch(/^https?:\/\//);

    expect(env.KEYCLOAK_REALM).toBeDefined();
    expect(env.KEYCLOAK_REALM.length).toBeGreaterThan(0);

    expect(env.JWT_SECRET).toBeDefined();
    expect(env.JWT_SECRET.length).toBeGreaterThanOrEqual(16);

    expect(env.BMAC_WEBHOOK_SECRET).toBeDefined();
    expect(env.BMAC_WEBHOOK_SECRET.length).toBeGreaterThan(0);

    expect(env.API_PORT).toBeDefined();
    expect(typeof env.API_PORT).toBe('number');
    expect(env.API_PORT).toBeGreaterThan(0);
    expect(env.API_PORT).toBeLessThan(65536);

    expect(env.NODE_ENV).toBeDefined();
    expect(['development', 'production', 'test']).toContain(env.NODE_ENV);

    expect(env.FRONTEND_URL).toBeDefined();
    expect(env.FRONTEND_URL).toMatch(/^https?:\/\//);
  });

  it('should provide environment helper flags', () => {
    const nodeEnv = env.NODE_ENV;

    if (nodeEnv === 'development') {
      expect(env.isDevelopment).toBe(true);
      expect(env.isProduction).toBe(false);
      expect(env.isTest).toBe(false);
    } else if (nodeEnv === 'production') {
      expect(env.isDevelopment).toBe(false);
      expect(env.isProduction).toBe(true);
      expect(env.isTest).toBe(false);
    } else if (nodeEnv === 'test') {
      expect(env.isDevelopment).toBe(false);
      expect(env.isProduction).toBe(false);
      expect(env.isTest).toBe(true);
    }
  });

  it('should use cached configuration on multiple accesses', () => {
    // Access env multiple times
    const firstAccess = {
      url: env.DATABASE_URL,
      port: env.API_PORT,
    };

    const secondAccess = {
      url: env.DATABASE_URL,
      port: env.API_PORT,
    };

    // Should return the same values
    expect(firstAccess.url).toBe(secondAccess.url);
    expect(firstAccess.port).toBe(secondAccess.port);
  });
});
