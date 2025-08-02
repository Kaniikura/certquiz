import { QUIZ_REPO_TOKEN, USER_REPO_TOKEN } from '@api/shared/types/RepositoryToken';
import { describe, expect, it, vi } from 'vitest';
import { createNoopLogger } from '@/test-support';
import { DrizzleUnitOfWork } from './DrizzleUnitOfWork';
import type { IUnitOfWork } from './IUnitOfWork';
import type { TransactionContext } from './uow';

describe('DrizzleUnitOfWork', () => {
  // Test helpers
  const mockTx = {} as TransactionContext;
  const logger = createNoopLogger();

  describe('constructor', () => {
    it('should create an instance of DrizzleUnitOfWork', () => {
      const uow = new DrizzleUnitOfWork(mockTx, logger);

      expect(uow).toBeDefined();
      expect(uow).toBeInstanceOf(DrizzleUnitOfWork);
    });

    it('should implement IUnitOfWork interface', () => {
      const uow: IUnitOfWork = new DrizzleUnitOfWork(mockTx, logger);

      expect(uow.begin).toBeDefined();
      expect(uow.commit).toBeDefined();
      expect(uow.rollback).toBeDefined();
      expect(uow.getRepository).toBeDefined();
    });
  });

  describe('transaction control methods', () => {
    it('should have begin method that returns Promise<void>', async () => {
      const uow = new DrizzleUnitOfWork(mockTx, logger);

      const result = await uow.begin();

      expect(result).toBeUndefined();
    });

    it('should have commit method that returns Promise<void>', async () => {
      const uow = new DrizzleUnitOfWork(mockTx, logger);

      const result = await uow.commit();

      expect(result).toBeUndefined();
    });

    it('should have rollback method that returns Promise<void>', async () => {
      const uow = new DrizzleUnitOfWork(mockTx, logger);

      const result = await uow.rollback();

      expect(result).toBeUndefined();
    });

    it('should log transaction lifecycle events', async () => {
      const mockLogger = {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      };
      const uow = new DrizzleUnitOfWork(mockTx, mockLogger);

      // Clear the creation log call
      mockLogger.debug.mockClear();

      await uow.begin();
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Transaction started'),
        expect.objectContaining({
          transactionId: expect.stringMatching(
            /^tx_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
          ),
        })
      );

      await uow.commit();
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Transaction committed'),
        expect.any(Object)
      );

      await uow.rollback();
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Transaction rolled back'),
        expect.any(Object)
      );
    });
  });

  describe('repository access', () => {
    it('should return a user repository instance', () => {
      const uow = new DrizzleUnitOfWork(mockTx, logger);

      const userRepo = uow.getRepository(USER_REPO_TOKEN);

      expect(userRepo).toBeDefined();
      // The actual type checking is done by TypeScript
    });

    it('should return the same user repository instance on multiple calls', () => {
      const uow = new DrizzleUnitOfWork(mockTx, logger);

      const userRepo1 = uow.getRepository(USER_REPO_TOKEN);
      const userRepo2 = uow.getRepository(USER_REPO_TOKEN);

      expect(userRepo1).toBe(userRepo2);
    });

    it('should return a quiz repository instance', () => {
      const uow = new DrizzleUnitOfWork(mockTx, logger);

      const quizRepo = uow.getRepository(QUIZ_REPO_TOKEN);

      expect(quizRepo).toBeDefined();
      // The actual type checking is done by TypeScript
    });

    it('should return the same quiz repository instance on multiple calls', () => {
      const uow = new DrizzleUnitOfWork(mockTx, logger);

      const quizRepo1 = uow.getRepository(QUIZ_REPO_TOKEN);
      const quizRepo2 = uow.getRepository(QUIZ_REPO_TOKEN);

      expect(quizRepo1).toBe(quizRepo2);
    });

    it('should create repositories with proper logger', () => {
      const mockLogger = {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      };
      const uow = new DrizzleUnitOfWork(mockTx, mockLogger);

      uow.getRepository(USER_REPO_TOKEN);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Repository created via token',
        expect.objectContaining({
          transactionId: expect.stringMatching(
            /^tx_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
          ),
          token: 'Symbol(USER_REPOSITORY)',
        })
      );

      uow.getRepository(QUIZ_REPO_TOKEN);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Repository created via token',
        expect.objectContaining({
          transactionId: expect.stringMatching(
            /^tx_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
          ),
          token: 'Symbol(QUIZ_REPOSITORY)',
        })
      );
    });

    // Note: Transaction context passing to repositories is verified through:
    // 1. TypeScript's type system at compile time
    // 2. Integration tests that verify actual database operations
    // Unit tests cannot mock dynamically imported constructors effectively
  });

  describe('transaction ID generation', () => {
    it('should generate unique transaction IDs', () => {
      const mockLogger = {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      };

      void new DrizzleUnitOfWork(mockTx, mockLogger);
      void new DrizzleUnitOfWork(mockTx, mockLogger);

      // Extract transaction IDs from debug calls
      const calls = mockLogger.debug.mock.calls;
      const txId1 = calls[0]?.[1]?.transactionId;
      const txId2 = calls[1]?.[1]?.transactionId;

      expect(txId1).toBeDefined();
      expect(txId2).toBeDefined();
      expect(txId1).not.toBe(txId2);
    });

    it('should generate transaction IDs in expected format', () => {
      const mockLogger = {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      };

      new DrizzleUnitOfWork(mockTx, mockLogger);

      const call = mockLogger.debug.mock.calls[0];
      const txId = call?.[1]?.transactionId;

      expect(txId).toMatch(/^tx_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    });
  });

  describe('repository caching', () => {
    it('should track which repositories were used in commit log', async () => {
      const mockLogger = {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      };
      const uow = new DrizzleUnitOfWork(mockTx, mockLogger);

      // Access repositories
      uow.getRepository(USER_REPO_TOKEN);
      uow.getRepository(QUIZ_REPO_TOKEN);

      // Commit should log which repositories were used
      await uow.commit();

      const commitCall = mockLogger.debug.mock.calls.find((call: unknown[]) => {
        const firstArg = call[0];
        return typeof firstArg === 'string' && firstArg.includes('committed');
      });
      // Repository keys are now symbols
      const repositoriesUsed = commitCall?.[1]?.repositoriesUsed as symbol[];
      expect(repositoriesUsed).toHaveLength(2);
      expect(repositoriesUsed.map((s) => s.toString())).toEqual([
        'Symbol(USER_REPOSITORY)',
        'Symbol(QUIZ_REPOSITORY)',
      ]);
    });

    it('should track which repositories were used in rollback log', async () => {
      const mockLogger = {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      };
      const uow = new DrizzleUnitOfWork(mockTx, mockLogger);

      // Access only user repository
      uow.getRepository(USER_REPO_TOKEN);

      // Rollback should log which repositories were used
      await uow.rollback();

      const rollbackCall = mockLogger.debug.mock.calls.find((call: unknown[]) => {
        const firstArg = call[0];
        return typeof firstArg === 'string' && firstArg.includes('rolled back');
      });
      // Repository keys are now symbols
      const repositoriesUsed = rollbackCall?.[1]?.repositoriesUsed as symbol[];
      expect(repositoriesUsed).toHaveLength(1);
      expect(repositoriesUsed.map((s) => s.toString())).toEqual(['Symbol(USER_REPOSITORY)']);
    });
  });
});
