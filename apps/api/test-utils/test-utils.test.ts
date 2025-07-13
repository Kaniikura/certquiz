/**
 * Test to verify the new test-utils structure works correctly
 */

// Test that we can import from the main barrel export
import { isBun, isNode } from '@api/test-utils';
// Test that we can import from sub-modules
import { buildDatabaseUrl, isValidPostgresUrl } from '@api/test-utils/db/container';
import { isExecError } from '@api/test-utils/errors';
import { describe, expect, it } from 'vitest';

describe('test-utils consolidation', () => {
  it('should be able to import runtime utilities from main barrel', () => {
    expect(typeof isBun).toBe('function');
    expect(typeof isNode).toBe('function');
  });

  it('should be able to import database utilities from sub-modules', () => {
    expect(typeof buildDatabaseUrl).toBe('function');
    expect(typeof isValidPostgresUrl).toBe('function');
  });

  it('should be able to import error utilities from sub-modules', () => {
    expect(typeof isExecError).toBe('function');
  });

  it('should correctly build database URLs', () => {
    const baseUrl = 'postgres://user:pass@localhost:5432/original';
    const newDbName = 'test_db';
    const result = buildDatabaseUrl(baseUrl, newDbName);

    expect(result).toBe('postgres://user:pass@localhost:5432/test_db');
  });

  it('should validate PostgreSQL URLs', () => {
    expect(isValidPostgresUrl('postgres://localhost/db')).toBe(true);
    expect(isValidPostgresUrl('postgresql://localhost/db')).toBe(true);
    expect(isValidPostgresUrl('http://localhost/db')).toBe(false);
    expect(isValidPostgresUrl('invalid-url')).toBe(false);
  });

  it('should detect runtime environment', () => {
    // At least one should be true
    expect(isBun() || isNode()).toBe(true);
  });
});
