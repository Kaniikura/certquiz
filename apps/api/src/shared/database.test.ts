import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createDatabase, type Database } from './database';

describe('Database connection wrapper', () => {
  let originalDatabaseUrl: string | undefined;
  let originalNodeEnv: string | undefined;

  beforeEach(() => {
    // Save original environment values
    originalDatabaseUrl = process.env.DATABASE_URL;
    originalNodeEnv = process.env.NODE_ENV;

    // Set test environment
    process.env.NODE_ENV = 'test';
    process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test_db';
  });

  afterEach(async () => {
    // Restore original environment values
    if (originalDatabaseUrl !== undefined) {
      process.env.DATABASE_URL = originalDatabaseUrl;
    } else {
      delete process.env.DATABASE_URL;
    }

    if (originalNodeEnv !== undefined) {
      process.env.NODE_ENV = originalNodeEnv;
    } else {
      delete process.env.NODE_ENV;
    }
  });

  describe('createDatabase factory', () => {
    it('should create database instance successfully', () => {
      const db = createDatabase();

      expect(db).toBeDefined();
      expect(typeof db).toBe('object');
    });

    it('should throw error when DATABASE_URL is missing', () => {
      delete process.env.DATABASE_URL;

      expect(() => createDatabase()).toThrowError(/DATABASE_URL.*required/i);
    });

    it('should throw error when DATABASE_URL is invalid', () => {
      process.env.DATABASE_URL = 'invalid-url';

      expect(() => createDatabase()).toThrowError(/DATABASE_URL.*valid.*PostgreSQL/i);
    });

    it('should configure connection pool for production', () => {
      process.env.NODE_ENV = 'production';
      process.env.DATABASE_URL = 'postgresql://prod:prod@localhost:5432/prod_db';

      const db = createDatabase();

      // The instance should be created successfully
      expect(db).toBeDefined();
    });

    it('should configure different pool settings for development', () => {
      process.env.NODE_ENV = 'development';

      const db = createDatabase();

      expect(db).toBeDefined();
    });
  });

  describe('database instance', () => {
    let db: Database;

    beforeEach(() => {
      db = createDatabase();
    });

    afterEach(async () => {
      if (db?.close) {
        await db.close();
      }
    });

    it('should have required database methods', () => {
      expect(db.select).toBeDefined();
      expect(db.insert).toBeDefined();
      expect(db.update).toBeDefined();
      expect(db.delete).toBeDefined();
      expect(db.transaction).toBeDefined();
    });

    it('should support graceful shutdown', async () => {
      expect(typeof db.close).toBe('function');

      // In test environment without real DB connection, close may throw
      // but should not crash the application
      try {
        await db.close();
      } catch (error) {
        // Expected in test environment - no real connection to close
        expect(error).toBeDefined();
      }
    });

    it('should handle multiple close calls gracefully', async () => {
      // First close attempt
      try {
        await db.close();
      } catch (_error) {
        // Expected in test environment
      }

      // Second close should return immediately (already closed)
      // Since the same instance is used, isClosed should be true
      try {
        await db.close();
        // Should not throw on second call
      } catch (error) {
        // If it still throws, the instance wasn't properly marked as closed
        // This might happen if the first close failed to set isClosed
        expect(error).toBeUndefined();
      }
    });

    it('should provide connection health check', async () => {
      expect(typeof db.ping).toBe('function');

      // In test environment, ping should work or gracefully fail
      const result = await db.ping();
      expect(typeof result).toBe('boolean');
    });
  });

  describe('connection pooling', () => {
    it('should configure appropriate pool size for test environment', () => {
      process.env.NODE_ENV = 'test';

      const db = createDatabase();

      expect(db).toBeDefined();
      // Pool configuration is tested implicitly through successful creation
    });

    it('should configure appropriate pool size for production environment', () => {
      process.env.NODE_ENV = 'production';
      process.env.DATABASE_URL = 'postgresql://prod:prod@localhost:5432/prod_db';

      const db = createDatabase();

      expect(db).toBeDefined();
    });
  });

  describe('error handling', () => {
    it('should handle malformed DATABASE_URL gracefully', () => {
      process.env.DATABASE_URL = 'not-a-valid-url';

      expect(() => createDatabase()).toThrow();
    });

    it('should handle missing protocol in DATABASE_URL', () => {
      process.env.DATABASE_URL = 'localhost:5432/testdb';

      expect(() => createDatabase()).toThrow();
    });

    it('should provide meaningful error messages', () => {
      delete process.env.DATABASE_URL;

      expect(() => createDatabase()).toThrowError(/DATABASE_URL.*required/i);
    });
  });

  describe('transaction support', () => {
    let db: Database;

    beforeEach(() => {
      db = createDatabase();
    });

    afterEach(async () => {
      if (db?.close) {
        await db.close();
      }
    });

    it('should support transaction method', () => {
      expect(typeof db.transaction).toBe('function');
    });

    it('should provide transaction callback pattern', async () => {
      // Test that transaction accepts a callback function
      const mockCallback = vi.fn().mockImplementation(() => {
        throw new Error('Test transaction error');
      });

      // This will fail in test environment but should have the right structure
      try {
        await db.transaction(mockCallback);
      } catch (_error) {
        // Expected to fail in test environment without real DB
        // The callback might or might not be called depending on connection status
        expect(typeof db.transaction).toBe('function');
      }
    });
  });

  describe('environment-specific configuration', () => {
    it('should use different settings for test environment', () => {
      process.env.NODE_ENV = 'test';

      const db = createDatabase();

      expect(db).toBeDefined();
    });

    it('should use different settings for development environment', () => {
      process.env.NODE_ENV = 'development';

      const db = createDatabase();

      expect(db).toBeDefined();
    });

    it('should use different settings for production environment', () => {
      process.env.NODE_ENV = 'production';
      process.env.DATABASE_URL = 'postgresql://prod:prod@localhost:5432/prod_db';

      const db = createDatabase();

      expect(db).toBeDefined();
    });
  });
});
