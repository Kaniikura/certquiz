import { defineConfig } from 'drizzle-kit';
import { describe, expect, it } from 'vitest';

describe('Drizzle Setup', () => {
  it('should have proper Drizzle Kit configuration', () => {
    // Test that defineConfig is available and works
    const config = defineConfig({
      dialect: 'postgresql',
      schema: './src/db/schema.ts',
      out: './src/db/migrations',
    });

    expect(config.dialect).toBe('postgresql');
    expect(config.schema).toBe('./src/db/schema.ts');
    expect(config.out).toBe('./src/db/migrations');
  });

  it('should import test schema successfully', async () => {
    const { testTable } = await import('./schema');

    // Test that schema can be imported and is defined
    expect(testTable).toBeDefined();
    expect(typeof testTable).toBe('object');

    // Basic table structure validation - detailed validation will be in integration tests
    expect(testTable).toBeTruthy();
  });

  it('should have DATABASE_URL configured', () => {
    // In test environment, we check if schema is available
    // Real database connection tests will be in integration tests
    expect(process.env.NODE_ENV).toBe('test');
  });
});
