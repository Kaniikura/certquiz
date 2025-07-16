import { describe, expect, it } from 'vitest';
import { migrateDown } from './api';

describe('Migration API', () => {
  describe('migrateDown', () => {
    it('should prevent execution in production environment', async () => {
      // Mock process.env.NODE_ENV to production
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      try {
        const result = await migrateDown('postgresql://test:test@localhost/test');

        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error).toContain('Migration rollback is not allowed in production');
          expect(result.error).toContain('Implement proper down migrations');
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
        const result = await migrateDown('postgresql://invalid:invalid@localhost/invalid');

        // Should not be blocked by production check (though it may fail for other reasons)
        if (!result.success) {
          expect(result.error).not.toContain('Migration rollback is not allowed in production');
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
        const result = await migrateDown('postgresql://invalid:invalid@localhost/invalid');

        // Should not be blocked by production check (though it may fail for other reasons)
        if (!result.success) {
          expect(result.error).not.toContain('Migration rollback is not allowed in production');
        }
      } finally {
        // Restore original environment
        process.env.NODE_ENV = originalEnv;
      }
    });
  });
});
