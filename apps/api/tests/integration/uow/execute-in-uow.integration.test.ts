import { User } from '@api/features/auth/domain/entities/User';
import { UserId } from '@api/features/auth/domain/value-objects/UserId';
import { db } from '@api/infra/db/client';
import { authUser } from '@api/infra/db/schema/user';
import { executeInUnitOfWork, withTransaction } from '@api/infra/unit-of-work';
import { setupTestDatabase } from '@api/test-utils/integration-helpers';
import { eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';

describe('Unit of Work Integration Tests', () => {
  // Setup isolated test database
  setupTestDatabase();

  beforeEach(async () => {
    // Clean up users table before each test
    await db.delete(authUser);
  });

  describe('withTransaction', () => {
    it('should be exported and be a function', () => {
      expect(withTransaction).toBeDefined();
      expect(typeof withTransaction).toBe('function');
    });
  });

  describe('executeInUnitOfWork', () => {
    it('should execute database operations within transaction', async () => {
      const userData = {
        userId: UserId.generate(),
        email: 'test@example.com',
        username: 'testuser',
        role: 'user' as const,
        identityProviderId: null,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Create user entity
      const userResult = User.fromPersistence(userData);
      expect(userResult.success).toBe(true);
      if (!userResult.success) {
        throw new Error('Failed to create user');
      }
      const user = userResult.data;

      // Insert user within transaction
      await executeInUnitOfWork(async (uow) => {
        const userRepo = uow.getUserRepository();
        await userRepo.save(user);
      });

      // Verify user was saved
      const savedUsers = await db
        .select()
        .from(authUser)
        .where(eq(authUser.userId, UserId.toString(user.id)));
      expect(savedUsers).toHaveLength(1);
      expect(savedUsers[0].email).toBe(userData.email);
    });

    it('should rollback transaction on error', async () => {
      const userData = {
        userId: UserId.generate(),
        email: 'rollback@example.com',
        username: 'rollbackuser',
        role: 'user' as const,
        identityProviderId: null,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const userResult = User.fromPersistence(userData);
      expect(userResult.success).toBe(true);
      if (!userResult.success) {
        throw new Error('Failed to create user');
      }
      const user = userResult.data;

      const error = new Error('Rollback test error');

      // Attempt to save user but throw error
      await expect(
        executeInUnitOfWork(async (uow) => {
          const userRepo = uow.getUserRepository();
          await userRepo.save(user);
          throw error;
        })
      ).rejects.toThrow(error);

      // Verify user was NOT saved due to rollback
      const savedUsers = await db
        .select()
        .from(authUser)
        .where(eq(authUser.userId, UserId.toString(user.id)));
      expect(savedUsers).toHaveLength(0);
    });

    it('should handle multiple repository operations in same transaction', async () => {
      const userData1 = {
        userId: UserId.generate(),
        email: 'multi1@example.com',
        username: 'multiuser1',
        role: 'user' as const,
        identityProviderId: null,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const userData2 = {
        userId: UserId.generate(),
        email: 'multi2@example.com',
        username: 'multiuser2',
        role: 'user' as const,
        identityProviderId: null,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const userResult1 = User.fromPersistence(userData1);
      const userResult2 = User.fromPersistence(userData2);
      expect(userResult1.success).toBe(true);
      expect(userResult2.success).toBe(true);
      if (!userResult1.success || !userResult2.success) {
        throw new Error('Failed to create users');
      }
      const user1 = userResult1.data;
      const user2 = userResult2.data;

      // Save multiple users in same transaction
      await executeInUnitOfWork(async (uow) => {
        const userRepo = uow.getUserRepository();
        await userRepo.save(user1);
        await userRepo.save(user2);
      });

      // Verify both users were saved
      const savedUser1 = await db
        .select()
        .from(authUser)
        .where(eq(authUser.userId, UserId.toString(user1.id)));
      const savedUser2 = await db
        .select()
        .from(authUser)
        .where(eq(authUser.userId, UserId.toString(user2.id)));
      expect(savedUser1).toHaveLength(1);
      expect(savedUser2).toHaveLength(1);
    });

    it('should isolate transactions from each other', async () => {
      const userData1 = {
        userId: UserId.generate(),
        email: 'isolation@example.com',
        username: 'isolationuser',
        role: 'user' as const,
        identityProviderId: null,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const userData2 = {
        userId: UserId.generate(),
        email: 'success@example.com',
        username: 'successuser',
        role: 'user' as const,
        identityProviderId: null,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const userResult1 = User.fromPersistence(userData1);
      const userResult2 = User.fromPersistence(userData2);
      expect(userResult1.success).toBe(true);
      expect(userResult2.success).toBe(true);
      if (!userResult1.success || !userResult2.success) {
        throw new Error('Failed to create users');
      }
      const failUser = userResult1.data;
      const successUser = userResult2.data;

      // Start a transaction that will fail
      const failedTransaction = executeInUnitOfWork(async (uow) => {
        const userRepo = uow.getUserRepository();
        await userRepo.save(failUser);
        // Simulate some work
        await new Promise((resolve) => setTimeout(resolve, 50));
        throw new Error('Transaction failure');
      }).catch(() => {
        // Expected to fail
      });

      // Start another transaction concurrently
      const successfulTransaction = executeInUnitOfWork(async (uow) => {
        const userRepo = uow.getUserRepository();
        await userRepo.save(successUser);
      });

      // Wait for both transactions
      await Promise.all([failedTransaction, successfulTransaction]);

      // Verify only the successful transaction's user was saved
      const failedUserRows = await db
        .select()
        .from(authUser)
        .where(eq(authUser.userId, UserId.toString(failUser.id)));
      const successUserRows = await db
        .select()
        .from(authUser)
        .where(eq(authUser.userId, UserId.toString(successUser.id)));

      expect(failedUserRows).toHaveLength(0);
      expect(successUserRows).toHaveLength(1);
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

        // Test that repositories work correctly

        // Create test user
        const userData = {
          userId: UserId.generate(),
          email: 'cache@example.com',
          username: 'cachetest',
          role: 'user' as const,
          identityProviderId: null,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        const userResult = User.fromPersistence(userData);
        expect(userResult.success).toBe(true);
        if (!userResult.success) {
          throw new Error('Failed to create user');
        }
        const testUser = userResult.data;

        // Both repository references should work identically
        await userRepo1.save(testUser);
        const foundUser = await userRepo2.findById(testUser.id);
        expect(foundUser).toBeDefined();
        expect(foundUser?.email.toString()).toBe(userData.email);
      });
    });
  });
});
