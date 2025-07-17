/**
 * Unit of Work tests
 * @fileoverview Tests for the Unit of Work pattern implementation
 */

import { NoopLogger } from '@api/shared/logger/LoggerPort';
import { describe, expect, it, vi } from 'vitest';
import { UnitOfWork, withTransaction, withUnitOfWork } from './uow';

// Mock the database client
vi.mock('./client', () => ({
  db: {
    transaction: vi.fn(),
  },
}));

describe('UnitOfWork', () => {
  const mockTransaction = { query: vi.fn(), select: vi.fn() };
  const logger = new NoopLogger();

  describe('constructor', () => {
    it('should create UnitOfWork with transaction and logger', () => {
      // biome-ignore lint/suspicious/noExplicitAny: Test requires casting to any
      const uow = new UnitOfWork(mockTransaction as any, logger);

      expect(uow).toBeInstanceOf(UnitOfWork);
      expect(uow.transaction).toBe(mockTransaction);
    });
  });

  describe('transaction access', () => {
    it('should provide access to underlying transaction', () => {
      // biome-ignore lint/suspicious/noExplicitAny: Test requires casting to any
      const uow = new UnitOfWork(mockTransaction as any, logger);

      expect(uow.transaction).toBe(mockTransaction);
    });
  });

  describe('repository access', () => {
    it('should handle missing repository gracefully', () => {
      // biome-ignore lint/suspicious/noExplicitAny: Test requires casting to any
      const uow = new UnitOfWork(mockTransaction as any, logger);

      // Should throw when repository modules are not available
      expect(() => uow.users).toThrow(/Cannot find module/);
      expect(() => uow.quizzes).toThrow(/Cannot find module/);
    });
  });
});

describe('withUnitOfWork', () => {
  it('should create UnitOfWork and pass it to function', async () => {
    const { db } = await import('./client');
    const mockTransaction = { query: vi.fn(), select: vi.fn() };

    // Mock db.transaction to call the callback with mock transaction
    // biome-ignore lint/suspicious/noExplicitAny: Mock function requires any type
    vi.mocked(db.transaction).mockImplementation(async (fn: any) => {
      return fn(mockTransaction);
    });

    const logger = new NoopLogger();
    let capturedUow: UnitOfWork | null = null;

    const result = await withUnitOfWork(async (uow) => {
      capturedUow = uow;
      return 'test-result';
    }, logger);

    expect(result).toBe('test-result');
    expect(capturedUow).toBeInstanceOf(UnitOfWork);
    expect(capturedUow!.transaction).toBe(mockTransaction);
    expect(db.transaction).toHaveBeenCalledOnce();
  });

  it('should propagate errors from function', async () => {
    const { db } = await import('./client');
    const mockTransaction = { query: vi.fn(), select: vi.fn() };
    // biome-ignore lint/suspicious/noExplicitAny: Mock function requires any type

    vi.mocked(db.transaction).mockImplementation(async (fn: any) => {
      return fn(mockTransaction);
    });

    const logger = new NoopLogger();
    const testError = new Error('test error');

    await expect(
      withUnitOfWork(async () => {
        throw testError;
      }, logger)
    ).rejects.toThrow('test error');
  });
});

describe('withTransaction (legacy)', () => {
  it('should be a bound function', async () => {
    // The function should be bound, so it's not the exact same reference
    expect(typeof withTransaction).toBe('function');
    expect(withTransaction.name).toContain('bound');
  });
});
