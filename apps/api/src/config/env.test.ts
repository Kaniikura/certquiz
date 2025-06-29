import { describe, expect, it } from 'vitest';
import { validEnvForTests } from '../../test-env';
import { loadEnv, validateEnv } from './env';

describe('Environment Configuration', () => {
  describe('validateEnv', () => {
    it('should validate all required environment variables', () => {
      // Setup is handled by vitest.setup.ts, but we can override specific values
      Object.assign(process.env, {
        ...validEnvForTests,
        API_PORT: '4000',
        NODE_ENV: 'test',
      });

      const result = validateEnv();

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.DATABASE_URL).toBe(validEnvForTests.DATABASE_URL);
        expect(result.data.KEYCLOAK_URL).toBe(validEnvForTests.KEYCLOAK_URL);
        expect(result.data.KEYCLOAK_REALM).toBe(validEnvForTests.KEYCLOAK_REALM);
        expect(result.data.JWT_SECRET).toBe(validEnvForTests.JWT_SECRET);
        expect(result.data.BMAC_WEBHOOK_SECRET).toBe(validEnvForTests.BMAC_WEBHOOK_SECRET);
        expect(result.data.API_PORT).toBe(4000);
        expect(result.data.NODE_ENV).toBe('test');
      }
    });

    it('should fail when required environment variables are missing', () => {
      // Remove required variables to test validation failure
      delete process.env.KEYCLOAK_URL;
      delete process.env.JWT_SECRET;

      const result = validateEnv();

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeDefined();
        expect(result.error.message).toContain('Invalid environment variables');
      }
    });

    it('should use default values for optional variables', () => {
      // Set required vars but omit optional ones to test defaults
      Object.assign(process.env, validEnvForTests);
      delete process.env.API_PORT; // Should use default
      delete process.env.NODE_ENV; // Should use default

      const result = validateEnv();

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.API_PORT).toBe(4000); // Default value
        expect(result.data.NODE_ENV).toBe('development'); // Default value
      }
    });

    it('should validate DATABASE_URL format', () => {
      // Set valid env then override with invalid DATABASE_URL
      Object.assign(process.env, validEnvForTests);
      process.env.DATABASE_URL = 'invalid-database-url';

      const result = validateEnv();

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toContain('DATABASE_URL');
      }
    });

    it('should validate KEYCLOAK_URL format', () => {
      // Set valid env then override with invalid KEYCLOAK_URL
      Object.assign(process.env, validEnvForTests);
      process.env.KEYCLOAK_URL = 'not-a-url';

      const result = validateEnv();

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toContain('KEYCLOAK_URL');
      }
    });

    it('should validate API_PORT is a valid number', () => {
      // Set valid env then override with invalid API_PORT
      Object.assign(process.env, validEnvForTests);
      process.env.API_PORT = 'not-a-number';

      const result = validateEnv();

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toContain('API_PORT');
      }
    });

    it('should require minimum JWT_SECRET length', () => {
      // Set valid env then override with short JWT_SECRET
      Object.assign(process.env, validEnvForTests);
      process.env.JWT_SECRET = 'short';

      const result = validateEnv();

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toContain('JWT_SECRET');
      }
    });
  });

  describe('loadEnv', () => {
    it('should load and return validated environment configuration', () => {
      // Override specific values for this test
      Object.assign(process.env, {
        ...validEnvForTests,
        API_PORT: '5000',
        NODE_ENV: 'production',
        FRONTEND_URL: 'https://certquiz.example.com',
      });

      const config = loadEnv();

      expect(config.DATABASE_URL).toBe(validEnvForTests.DATABASE_URL);
      expect(config.API_PORT).toBe(5000);
      expect(config.NODE_ENV).toBe('production');
      expect(config.FRONTEND_URL).toBe('https://certquiz.example.com');
      expect(config.isDevelopment).toBe(false);
      expect(config.isProduction).toBe(true);
      expect(config.isTest).toBe(false);
    });

    it('should throw error when environment validation fails', () => {
      // Remove all environment variables to trigger validation failure
      for (const key of Object.keys(process.env)) {
        if (key.startsWith('DATABASE_') || key.startsWith('KEYCLOAK_') || key.startsWith('JWT_')) {
          delete process.env[key];
        }
      }

      expect(() => loadEnv()).toThrow('Invalid environment variables');
    });

    it('should set correct boolean flags for different environments', () => {
      // Test development
      Object.assign(process.env, {
        ...validEnvForTests,
        NODE_ENV: 'development',
      });

      let config = loadEnv();
      expect(config.isDevelopment).toBe(true);
      expect(config.isProduction).toBe(false);
      expect(config.isTest).toBe(false);

      // Test production
      process.env.NODE_ENV = 'production';
      config = loadEnv();
      expect(config.isDevelopment).toBe(false);
      expect(config.isProduction).toBe(true);
      expect(config.isTest).toBe(false);

      // Test test environment
      process.env.NODE_ENV = 'test';
      config = loadEnv();
      expect(config.isDevelopment).toBe(false);
      expect(config.isProduction).toBe(false);
      expect(config.isTest).toBe(true);
    });
  });
});
