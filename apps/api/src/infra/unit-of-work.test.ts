// Set up DATABASE_URL before any imports that might use it
// This ensures the database client doesn't fail validation during module loading
import { baseTestEnv } from '../../test-env';

process.env.DATABASE_URL = baseTestEnv.DATABASE_URL;

import { describe, expect, it } from 'vitest';
import { DrizzleUnitOfWork } from './db/DrizzleUnitOfWork';
import type { IUnitOfWork } from './db/IUnitOfWork';
import { executeInUnitOfWork, unitOfWorkFactory, withTransaction } from './unit-of-work';

describe('unit-of-work facade', () => {
  describe('legacy withTransaction', () => {
    it('should still be exported for backward compatibility', () => {
      expect(withTransaction).toBeDefined();
      expect(typeof withTransaction).toBe('function');
    });
  });

  describe('unitOfWorkFactory', () => {
    it('should be a singleton instance', () => {
      expect(unitOfWorkFactory).toBeDefined();
      expect(unitOfWorkFactory.create).toBeDefined();
    });
  });

  describe('executeInUnitOfWork', () => {
    it('should execute callback with Unit of Work instance', async () => {
      let capturedUow: IUnitOfWork | null = null;
      const expectedResult = { data: 'test' };

      const result = await executeInUnitOfWork(async (uow) => {
        capturedUow = uow;
        return expectedResult;
      });

      expect(result).toBe(expectedResult);
      expect(capturedUow).toBeDefined();
      expect(capturedUow).toBeInstanceOf(DrizzleUnitOfWork);
    });

    it('should provide access to repositories', async () => {
      await executeInUnitOfWork(async (uow) => {
        const userRepo = uow.getUserRepository();
        const quizRepo = uow.getQuizRepository();

        expect(userRepo).toBeDefined();
        expect(quizRepo).toBeDefined();
        expect(userRepo.findById).toBeDefined();
        expect(quizRepo.findById).toBeDefined();
      });
    });

    it('should propagate errors from callback', async () => {
      const error = new Error('Test error');

      await expect(
        executeInUnitOfWork(async () => {
          throw error;
        })
      ).rejects.toThrow(error);
    });

    it('should handle async operations correctly', async () => {
      const result = await executeInUnitOfWork(async (uow) => {
        // Simulate async repository operations
        await new Promise((resolve) => setTimeout(resolve, 10));

        const userRepo = uow.getUserRepository();
        const quizRepo = uow.getQuizRepository();

        return {
          hasUserRepo: userRepo !== undefined,
          hasQuizRepo: quizRepo !== undefined,
        };
      });

      expect(result).toEqual({
        hasUserRepo: true,
        hasQuizRepo: true,
      });
    });

    it('should ensure repository instances are cached within transaction', async () => {
      await executeInUnitOfWork(async (uow) => {
        const userRepo1 = uow.getUserRepository();
        const userRepo2 = uow.getUserRepository();
        const quizRepo1 = uow.getQuizRepository();
        const quizRepo2 = uow.getQuizRepository();

        // Same instances should be returned
        expect(userRepo1).toBe(userRepo2);
        expect(quizRepo1).toBe(quizRepo2);
      });
    });
  });

  describe('exports', () => {
    it('should export all necessary types and functions', async () => {
      // Dynamic imports to check if exports are available
      const unitOfWork = await import('./unit-of-work');

      // Check type exports (these will be undefined at runtime but TypeScript will validate)
      expect(unitOfWork).toHaveProperty('unitOfWorkFactory');
      expect(unitOfWork).toHaveProperty('executeInUnitOfWork');
      expect(unitOfWork).toHaveProperty('withTransaction');
      expect(unitOfWork).toHaveProperty('UnitOfWorkFactory');
      expect(unitOfWork).toHaveProperty('withUnitOfWork');
    });
  });
});
