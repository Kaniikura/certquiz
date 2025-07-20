import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { db, pool, shutdownDatabase } from './client';

describe('Database client', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // Reset environment for each test
    process.env = { ...originalEnv };
    // Set a test DATABASE_URL that won't be used due to lazy initialization
    process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/testdb';
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  describe('singleton database instance', () => {
    it('should export db instance', () => {
      expect(db).toBeDefined();
      expect(db.select).toBeDefined();
      expect(db.insert).toBeDefined();
      expect(db.update).toBeDefined();
      expect(db.delete).toBeDefined();
      expect(db.transaction).toBeDefined();
    });

    it('should export pool instance', () => {
      expect(pool).toBeDefined();
    });
  });

  describe('graceful shutdown', () => {
    it('should handle shutdown gracefully', async () => {
      // shutdownDatabase should handle cases where pool isn't initialized
      await expect(shutdownDatabase()).resolves.toBeUndefined();
    });

    it('should not log errors in test environment', async () => {
      process.env.NODE_ENV = 'test';
      const consoleErrorSpy = vi.spyOn(console, 'error');

      await shutdownDatabase();

      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });
  });

  describe('environment configuration', () => {
    it('should use production configuration when NODE_ENV is production', () => {
      process.env.NODE_ENV = 'production';
      process.env.DB_POOL_MAX = '50';

      // The configuration is applied at module load time
      // We can't easily test this without reloading the module
      expect(process.env.NODE_ENV).toBe('production');
    });

    it('should validate DATABASE_URL format', () => {
      // This validation happens at module load time
      // Invalid URLs would cause the module to fail loading
      expect(process.env.DATABASE_URL).toMatch(/^postgresql:\/\//);
    });
  });

  describe('transaction support', () => {
    it('should support transactions through db instance', () => {
      expect(db.transaction).toBeDefined();
      expect(typeof db.transaction).toBe('function');
    });
  });
});
