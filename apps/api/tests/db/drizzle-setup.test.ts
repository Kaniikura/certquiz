import { describe, expect, it } from 'vitest';

describe('Drizzle Setup', () => {
  it('should have proper Drizzle Kit configuration', async () => {
    // Import actual drizzle.config.ts and verify its properties
    const config = await import('../../drizzle.config');

    expect(config.default).toBeDefined();
    expect(config.default.dialect).toBe('postgresql');
    expect(config.default.schema).toBe('./db/schema/index.ts');
    expect(config.default.out).toBe('./db/migrations');
    expect(config.default.verbose).toBe(true);
    expect(config.default.strict).toBe(true);
  });

  it('should import schema successfully', async () => {
    const { users } = await import('../../db/schema');

    // Test that schema can be imported and is defined
    expect(users).toBeDefined();
    expect(typeof users).toBe('object');
  });

  it('should validate test environment setup', () => {
    // Verify we're in test environment
    expect(process.env.NODE_ENV).toBe('test');
  });
});