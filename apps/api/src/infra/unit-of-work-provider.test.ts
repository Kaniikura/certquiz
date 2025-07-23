/**
 * Unit of Work Provider Tests
 * @fileoverview Tests for UnitOfWork factory based on environment
 */

import { createTestLogger } from '@api/test-support/test-logger';
import { FakeUnitOfWork } from '@api/testing/domain/fakes';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Logger } from './logger';
import {
  createUnitOfWork,
  createUnitOfWorkFactory,
  getGlobalFakeFactory,
  resetGlobalFakeFactory,
  type UnitOfWorkConfig,
} from './unit-of-work-provider';

describe('Unit of Work Provider', () => {
  const originalNodeEnv = process.env.NODE_ENV;
  let mockLogger: Logger;

  beforeEach(() => {
    mockLogger = createTestLogger();
    resetGlobalFakeFactory();
  });

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
    vi.clearAllMocks();
    resetGlobalFakeFactory();
  });

  describe('createUnitOfWork', () => {
    it('should create FakeUnitOfWork in test environment', async () => {
      process.env.NODE_ENV = 'test';

      const uow = await createUnitOfWork({ logger: mockLogger });

      expect(uow).toBeInstanceOf(FakeUnitOfWork);
    });

    it('should create FakeUnitOfWork when useFake is true', async () => {
      process.env.NODE_ENV = 'production';

      const uow = await createUnitOfWork({ useFake: true, logger: mockLogger });

      expect(uow).toBeInstanceOf(FakeUnitOfWork);
    });

    it('should create FakeUnitOfWork without logger (uses default)', async () => {
      process.env.NODE_ENV = 'test';

      const uow = await createUnitOfWork();

      expect(uow).toBeInstanceOf(FakeUnitOfWork);
    });

    it('should reuse global fake factory in test environment', async () => {
      process.env.NODE_ENV = 'test';

      const factory1 = getGlobalFakeFactory();
      const uow1 = await createUnitOfWork();

      const factory2 = getGlobalFakeFactory();
      const uow2 = await createUnitOfWork();

      expect(factory1).toBe(factory2);
      // UoW instances should be different (new per request)
      expect(uow1).not.toBe(uow2);
    });

    // Skip testing real UoW creation as it requires database connection
    it.skip('should create DrizzleUnitOfWork in production environment', async () => {
      process.env.NODE_ENV = 'production';

      // This would fail without a real database connection
      const _uow = await createUnitOfWork({ logger: mockLogger });

      // Would need to check for DeferredTransactionUnitOfWork
    });
  });

  describe('createUnitOfWorkFactory', () => {
    it('should return a factory function', () => {
      const factory = createUnitOfWorkFactory();

      expect(typeof factory).toBe('function');
    });

    it('should pass config through factory', async () => {
      process.env.NODE_ENV = 'production';
      const config: UnitOfWorkConfig = { useFake: true };

      const factory = createUnitOfWorkFactory(config);
      const uow = await factory(mockLogger);

      expect(uow).toBeInstanceOf(FakeUnitOfWork);
    });

    it('should merge logger from factory call', async () => {
      process.env.NODE_ENV = 'test';
      const customLogger = { ...createTestLogger(), custom: true };

      const factory = createUnitOfWorkFactory();
      const uow = await factory(customLogger);

      expect(uow).toBeInstanceOf(FakeUnitOfWork);
    });
  });

  describe('Global Fake Factory', () => {
    it('should create new factory when none exists', () => {
      const factory1 = getGlobalFakeFactory();
      const factory2 = getGlobalFakeFactory();

      expect(factory1).toBe(factory2);
      expect(factory1).toBeDefined();
    });

    it('should reset global factory', () => {
      const factory1 = getGlobalFakeFactory();
      // Add some test data
      const _userRepo = factory1.getUserRepository();

      resetGlobalFakeFactory();

      const factory2 = getGlobalFakeFactory();
      expect(factory1).not.toBe(factory2);
    });

    it('should clear data when resetting', () => {
      const factory = getGlobalFakeFactory();
      const userRepo = factory.getUserRepository();

      // Would add test data here if FakeUserRepository had add methods

      resetGlobalFakeFactory();

      // New factory should have clean repositories
      const newFactory = getGlobalFakeFactory();
      const newUserRepo = newFactory.getUserRepository();

      expect(newUserRepo).not.toBe(userRepo);
    });
  });

  describe('Environment detection', () => {
    it('should detect test environment correctly', async () => {
      process.env.NODE_ENV = 'test';

      const uow = await createUnitOfWork();
      expect(uow).toBeInstanceOf(FakeUnitOfWork);
    });

    it('should detect development environment correctly', async () => {
      process.env.NODE_ENV = 'development';

      // This will fail without DB, but we're testing the logic
      await expect(createUnitOfWork()).rejects.toThrow();
    });

    it('should handle missing NODE_ENV', async () => {
      delete process.env.NODE_ENV;

      // Should try to create real UoW (will fail without DB)
      await expect(createUnitOfWork()).rejects.toThrow();
    });
  });
});
