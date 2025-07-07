import { describe, expect, it } from 'vitest';

describe('Drizzle Setup', () => {
  it('should have proper Drizzle Kit configuration', async () => {
    // Import actual drizzle.config.ts and verify its properties
    const config = await import('../../drizzle.config');

    expect(config.default).toBeDefined();
    expect(config.default.dialect).toBe('postgresql');
    // Schema will be added incrementally as we implement vertical slices
    expect(config.default.schema).toBe('./src/infra/db/schema/*.ts');
    expect(config.default.out).toBe('./src/infra/db/migrations');
    expect(config.default.verbose).toBe(true);
    expect(config.default.strict).toBe(true);
  });

  // Schema will be added incrementally as we implement vertical slices (Day 2+)
  // For now, we're on Day 1 with minimal infrastructure only

  it('should validate test environment setup', () => {
    // Verify we're in test environment
    expect(process.env.NODE_ENV).toBe('test');
  });
});
