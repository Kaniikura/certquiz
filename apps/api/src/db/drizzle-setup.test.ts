import { describe, expect, it } from 'vitest';

describe('Drizzle Setup', () => {
  it('should have proper Drizzle Kit configuration', async () => {
    // Import actual drizzle.config.ts and verify its properties
    const config = await import('../../drizzle.config');

    expect(config.default).toBeDefined();
    expect(config.default.dialect).toBe('postgresql');
    expect(config.default.schema).toBe('./src/db/schema.ts');
    expect(config.default.out).toBe('./src/db/migrations');
    expect(config.default.verbose).toBe(true);
    expect(config.default.strict).toBe(true);
  });

  it('should import test schema successfully', async () => {
    const { testTable } = await import('./schema');

    // Test that schema can be imported and is defined
    expect(testTable).toBeDefined();
    expect(typeof testTable).toBe('object');
  });

  it('should validate test environment setup', () => {
    // Verify we're in test environment
    expect(process.env.NODE_ENV).toBe('test');
  });
});
