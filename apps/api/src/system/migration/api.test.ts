import { describe, expect, it } from 'vitest';
import { resetDatabaseForTesting } from './api';

describe('Migration API', () => {
  describe('resetDatabaseForTesting', () => {
    it('should prevent execution in production environment', async () => {
      // Mock process.env.NODE_ENV to production
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      try {
        const result = await resetDatabaseForTesting('postgresql://test:test@localhost/test');

        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error).toContain('Database reset is not allowed in production');
          expect(result.error).toContain('For production rollbacks');
        }
      } finally {
        // Restore original environment
        process.env.NODE_ENV = originalEnv;
      }
    });

    it('should allow execution in development environment', async () => {
      // Mock process.env.NODE_ENV to development
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      try {
        // This will still fail due to invalid connection string, but should not be blocked by production check
        const result = await resetDatabaseForTesting(
          'postgresql://invalid:invalid@localhost/invalid'
        );

        // Should not be blocked by production check (though it may fail for other reasons)
        if (!result.success) {
          expect(result.error).not.toContain('Database reset is not allowed in production');
        }
      } finally {
        // Restore original environment
        process.env.NODE_ENV = originalEnv;
      }
    });

    it('should allow execution in test environment', async () => {
      // Mock process.env.NODE_ENV to test
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'test';

      try {
        // This will still fail due to invalid connection string, but should not be blocked by production check
        const result = await resetDatabaseForTesting(
          'postgresql://invalid:invalid@localhost/invalid'
        );

        // Should not be blocked by production check (though it may fail for other reasons)
        if (!result.success) {
          expect(result.error).not.toContain('Database reset is not allowed in production');
        }
      } finally {
        // Restore original environment
        process.env.NODE_ENV = originalEnv;
      }
    });
  });
});
