import { QUIZ_REPO_TOKEN, USER_REPO_TOKEN } from '@api/shared/types/RepositoryToken';
import { createNoopLogger } from '@api/test-support/test-logger';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DrizzleUnitOfWork } from './DrizzleUnitOfWork';
import type { IUnitOfWork } from './IUnitOfWork';
import { UnitOfWorkFactory, withUnitOfWork } from './UnitOfWorkFactory';
import type { TransactionContext } from './uow';

// Define the type for a database that supports transactions
interface TransactionalDatabase {
  transaction<T>(fn: (tx: TransactionContext) => Promise<T>): Promise<T>;
}

describe('UnitOfWorkFactory', () => {
  const mockTx = {} as TransactionContext;
  const logger = createNoopLogger();

  describe('create method', () => {
    it('should create a DrizzleUnitOfWork instance', () => {
      const factory = new UnitOfWorkFactory(logger);
      const uow = factory.create(mockTx);

      expect(uow).toBeDefined();
      expect(uow).toBeInstanceOf(DrizzleUnitOfWork);
      expect(uow).toHaveProperty('begin');
      expect(uow).toHaveProperty('commit');
      expect(uow).toHaveProperty('rollback');
      expect(uow).toHaveProperty('getRepository');
    });

    it('should pass transaction context and logger to DrizzleUnitOfWork', () => {
      const mockLogger = {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      };
      const factory = new UnitOfWorkFactory(mockLogger);
      void factory.create(mockTx);

      // Verify logger was used during creation
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'DrizzleUnitOfWork created',
        expect.objectContaining({
          transactionId: expect.stringMatching(
            /^tx_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
          ),
        })
      );
    });

    it('should create new instances on each call', () => {
      const factory = new UnitOfWorkFactory(logger);
      const uow1 = factory.create(mockTx);
      const uow2 = factory.create(mockTx);

      expect(uow1).not.toBe(uow2);
    });
  });
});

describe('withUnitOfWork', () => {
  // Mock the Drizzle transaction function
  const mockTransaction = vi.fn();
  const mockDb = {
    transaction: mockTransaction,
  };
  const mockTx = {} as TransactionContext;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should execute callback with UnitOfWork instance', async () => {
    const logger = createNoopLogger();
    const factory = new UnitOfWorkFactory(logger);
    const expectedResult = { data: 'test' };

    // Mock transaction to call the callback with mockTx
    mockTransaction.mockImplementation(async (callback) => {
      return callback(mockTx);
    });

    const result = await withUnitOfWork(
      mockDb as TransactionalDatabase,
      factory,
      async (uow: IUnitOfWork) => {
        expect(uow).toBeInstanceOf(DrizzleUnitOfWork);
        expect(uow.getRepository).toBeDefined();
        return expectedResult;
      }
    );

    expect(result).toBe(expectedResult);
    expect(mockTransaction).toHaveBeenCalledTimes(1);
  });

  it('should propagate errors from callback', async () => {
    const logger = createNoopLogger();
    const factory = new UnitOfWorkFactory(logger);
    const error = new Error('Test error');

    // Mock transaction to call the callback with mockTx
    mockTransaction.mockImplementation(async (callback) => {
      return callback(mockTx);
    });

    await expect(
      withUnitOfWork(mockDb as TransactionalDatabase, factory, async () => {
        throw error;
      })
    ).rejects.toThrow(error);

    expect(mockTransaction).toHaveBeenCalledTimes(1);
  });

  it('should handle transaction errors', async () => {
    const logger = createNoopLogger();
    const factory = new UnitOfWorkFactory(logger);
    const error = new Error('Transaction error');

    // Mock transaction to throw an error
    mockTransaction.mockRejectedValue(error);

    await expect(
      withUnitOfWork(mockDb as TransactionalDatabase, factory, async () => {
        return 'should not reach here';
      })
    ).rejects.toThrow(error);

    expect(mockTransaction).toHaveBeenCalledTimes(1);
  });

  it('should work with async operations', async () => {
    const logger = createNoopLogger();
    const factory = new UnitOfWorkFactory(logger);

    mockTransaction.mockImplementation(async (callback) => {
      return callback(mockTx);
    });

    const result = await withUnitOfWork(
      mockDb as TransactionalDatabase,
      factory,
      async (uow: IUnitOfWork) => {
        // Simulate async repository operations
        const userRepo = uow.getRepository(USER_REPO_TOKEN);
        const quizRepo = uow.getRepository(QUIZ_REPO_TOKEN);

        // Simulate some async work
        await new Promise((resolve) => setTimeout(resolve, 10));

        return {
          hasUserRepo: userRepo !== undefined,
          hasQuizRepo: quizRepo !== undefined,
        };
      }
    );

    expect(result).toEqual({
      hasUserRepo: true,
      hasQuizRepo: true,
    });
  });
});
