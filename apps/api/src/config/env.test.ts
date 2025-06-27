import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { loadEnv, validateEnv } from './env';

describe('Environment Configuration', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // Reset process.env before each test
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
  });

  describe('validateEnv', () => {
    it('should validate all required environment variables', () => {
      process.env = {
        ...process.env,
        DATABASE_URL: 'postgresql://postgres:password@localhost:5432/certquiz',
        KEYCLOAK_URL: 'http://localhost:8080',
        KEYCLOAK_REALM: 'certquiz',
        JWT_SECRET: 'test-secret-key-with-minimum-length',
        BMAC_WEBHOOK_SECRET: 'test-webhook-secret',
        API_PORT: '4000',
        NODE_ENV: 'test',
      };

      const result = validateEnv();

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.DATABASE_URL).toBe(
          'postgresql://postgres:password@localhost:5432/certquiz'
        );
        expect(result.data.KEYCLOAK_URL).toBe('http://localhost:8080');
        expect(result.data.KEYCLOAK_REALM).toBe('certquiz');
        expect(result.data.JWT_SECRET).toBe('test-secret-key-with-minimum-length');
        expect(result.data.BMAC_WEBHOOK_SECRET).toBe('test-webhook-secret');
        expect(result.data.API_PORT).toBe(4000);
        expect(result.data.NODE_ENV).toBe('test');
      }
    });

    it('should fail when required environment variables are missing', () => {
      process.env = {
        DATABASE_URL: 'postgresql://postgres:password@localhost:5432/certquiz',
        // Missing other required variables
      };

      const result = validateEnv();

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeDefined();
        expect(result.error.message).toContain('Invalid environment variables');
      }
    });

    it('should use default values for optional variables', () => {
      process.env = {
        DATABASE_URL: 'postgresql://postgres:password@localhost:5432/certquiz',
        KEYCLOAK_URL: 'http://localhost:8080',
        KEYCLOAK_REALM: 'certquiz',
        JWT_SECRET: 'test-secret-key-with-minimum-length',
        BMAC_WEBHOOK_SECRET: 'test-webhook-secret',
        // API_PORT not provided, should use default
      };

      const result = validateEnv();

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.API_PORT).toBe(4000); // Default value
        expect(result.data.NODE_ENV).toBe('development'); // Default value
      }
    });

    it('should validate DATABASE_URL format', () => {
      process.env = {
        DATABASE_URL: 'invalid-database-url',
        KEYCLOAK_URL: 'http://localhost:8080',
        KEYCLOAK_REALM: 'certquiz',
        JWT_SECRET: 'test-secret-key-with-minimum-length',
        BMAC_WEBHOOK_SECRET: 'test-webhook-secret',
      };

      const result = validateEnv();

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toContain('DATABASE_URL');
      }
    });

    it('should validate KEYCLOAK_URL format', () => {
      process.env = {
        DATABASE_URL: 'postgresql://postgres:password@localhost:5432/certquiz',
        KEYCLOAK_URL: 'not-a-url',
        KEYCLOAK_REALM: 'certquiz',
        JWT_SECRET: 'test-secret-key-with-minimum-length',
        BMAC_WEBHOOK_SECRET: 'test-webhook-secret',
      };

      const result = validateEnv();

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toContain('KEYCLOAK_URL');
      }
    });

    it('should validate API_PORT is a valid number', () => {
      process.env = {
        DATABASE_URL: 'postgresql://postgres:password@localhost:5432/certquiz',
        KEYCLOAK_URL: 'http://localhost:8080',
        KEYCLOAK_REALM: 'certquiz',
        JWT_SECRET: 'test-secret-key-with-minimum-length',
        BMAC_WEBHOOK_SECRET: 'test-webhook-secret',
        API_PORT: 'not-a-number',
      };

      const result = validateEnv();

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toContain('API_PORT');
      }
    });

    it('should require minimum JWT_SECRET length', () => {
      process.env = {
        DATABASE_URL: 'postgresql://postgres:password@localhost:5432/certquiz',
        KEYCLOAK_URL: 'http://localhost:8080',
        KEYCLOAK_REALM: 'certquiz',
        JWT_SECRET: 'short',
        BMAC_WEBHOOK_SECRET: 'test-webhook-secret',
      };

      const result = validateEnv();

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toContain('JWT_SECRET');
      }
    });
  });

  describe('loadEnv', () => {
    it('should load and return validated environment configuration', () => {
      process.env = {
        DATABASE_URL: 'postgresql://postgres:password@localhost:5432/certquiz',
        KEYCLOAK_URL: 'http://localhost:8080',
        KEYCLOAK_REALM: 'certquiz',
        JWT_SECRET: 'test-secret-key-with-minimum-length',
        BMAC_WEBHOOK_SECRET: 'test-webhook-secret',
        API_PORT: '5000',
        NODE_ENV: 'production',
        FRONTEND_URL: 'https://certquiz.example.com',
      };

      const config = loadEnv();

      expect(config.DATABASE_URL).toBe('postgresql://postgres:password@localhost:5432/certquiz');
      expect(config.API_PORT).toBe(5000);
      expect(config.NODE_ENV).toBe('production');
      expect(config.FRONTEND_URL).toBe('https://certquiz.example.com');
      expect(config.isDevelopment).toBe(false);
      expect(config.isProduction).toBe(true);
      expect(config.isTest).toBe(false);
    });

    it('should throw error when environment validation fails', () => {
      process.env = {}; // Empty environment

      expect(() => loadEnv()).toThrow('Invalid environment variables');
    });

    it('should set correct boolean flags for different environments', () => {
      // Test development
      process.env = {
        DATABASE_URL: 'postgresql://postgres:password@localhost:5432/certquiz',
        KEYCLOAK_URL: 'http://localhost:8080',
        KEYCLOAK_REALM: 'certquiz',
        JWT_SECRET: 'test-secret-key-with-minimum-length',
        BMAC_WEBHOOK_SECRET: 'test-webhook-secret',
        NODE_ENV: 'development',
      };

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
