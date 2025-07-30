import { AuthUser } from '@api/features/auth';
import { UserId } from '@api/features/auth/domain';
import { getDb } from '@api/infra/db/client';
import { authUser } from '@api/infra/db/schema';
import { executeInUnitOfWork, withTransaction } from '@api/infra/unit-of-work';
import { AUTH_USER_REPO_TOKEN, QUIZ_REPO_TOKEN } from '@api/shared/types/RepositoryToken';
import { setupTestDatabase } from '@api/testing/domain';
import { eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import type { TestApp } from '../../setup/test-app-factory';
import { createIntegrationTestApp } from '../../setup/test-app-factory';

describe('Unit of Work Integration Tests', () => {
  // Setup isolated test database
  setupTestDatabase();

  let testApp: TestApp;

  beforeEach(async () => {
    // Create integration test app using DI container for database access
    testApp = createIntegrationTestApp();

    // Clean up users table before each test
    // For UoW testing, we use direct DB access for cleanup since we're testing the abstraction
    const db = getDb();
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
      const userResult = AuthUser.fromPersistence(userData);
      expect(userResult.success).toBe(true);
      if (!userResult.success) {
        throw new Error('Failed to create user');
      }
      const user = userResult.data;

      // Insert user within transaction
      await executeInUnitOfWork(async (uow) => {
        const userRepo = uow.getRepository(AUTH_USER_REPO_TOKEN);
        await userRepo.save(user);
      });

      // Verify user was saved through UoW
      const uowProvider = testApp.getUnitOfWorkProvider?.();
      if (!uowProvider) throw new Error('UoW provider not available');

      await uowProvider.execute(async (uow) => {
        const userRepo = uow.getRepository(AUTH_USER_REPO_TOKEN);
        const savedUser = await userRepo.findById(user.id);
        expect(savedUser).toBeDefined();
        expect(savedUser?.email.toString()).toBe(userData.email);
      });
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

      const userResult = AuthUser.fromPersistence(userData);
      expect(userResult.success).toBe(true);
      if (!userResult.success) {
        throw new Error('Failed to create user');
      }
      const user = userResult.data;

      const error = new Error('Rollback test error');

      // Attempt to save user but throw error
      await expect(
        executeInUnitOfWork(async (uow) => {
          const userRepo = uow.getRepository(AUTH_USER_REPO_TOKEN);
          await userRepo.save(user);
          throw error;
        })
      ).rejects.toThrow(error);

      // Verify user was NOT saved due to rollback
      // Use direct DB access for verification since we're testing the UoW abstraction
      const db = getDb();
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

      const userResult1 = AuthUser.fromPersistence(userData1);
      const userResult2 = AuthUser.fromPersistence(userData2);
      expect(userResult1.success).toBe(true);
      expect(userResult2.success).toBe(true);
      if (!userResult1.success || !userResult2.success) {
        throw new Error('Failed to create users');
      }
      const user1 = userResult1.data;
      const user2 = userResult2.data;

      // Save multiple users in same transaction
      await executeInUnitOfWork(async (uow) => {
        const userRepo = uow.getRepository(AUTH_USER_REPO_TOKEN);
        await userRepo.save(user1);
        await userRepo.save(user2);
      });

      // Verify both users were saved
      // Use direct DB access for verification since we're testing the UoW abstraction
      const db = getDb();
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

      const userResult1 = AuthUser.fromPersistence(userData1);
      const userResult2 = AuthUser.fromPersistence(userData2);
      expect(userResult1.success).toBe(true);
      expect(userResult2.success).toBe(true);
      if (!userResult1.success || !userResult2.success) {
        throw new Error('Failed to create users');
      }
      const failUser = userResult1.data;
      const successUser = userResult2.data;

      // Create synchronization mechanism to ensure proper transaction overlap
      let firstTransactionSaveCompleted: () => void;
      const saveCompletedPromise = new Promise<void>((resolve) => {
        firstTransactionSaveCompleted = resolve;
      });

      // Start a transaction that will fail
      const failedTransaction = executeInUnitOfWork(async (uow) => {
        const userRepo = uow.getRepository(AUTH_USER_REPO_TOKEN);
        await userRepo.save(failUser);
        // Signal that the save is completed so second transaction can start
        firstTransactionSaveCompleted();
        // Simulate some work to keep transaction open
        await new Promise((resolve) => setTimeout(resolve, 50));
        throw new Error('Transaction failure');
      }).catch(() => {
        // Expected to fail
      });

      // Wait for first transaction to complete its save, then start second transaction
      await saveCompletedPromise;
      const successfulTransaction = executeInUnitOfWork(async (uow) => {
        const userRepo = uow.getRepository(AUTH_USER_REPO_TOKEN);
        await userRepo.save(successUser);
      });

      // Wait for both transactions
      await Promise.all([failedTransaction, successfulTransaction]);

      // Verify only the successful transaction's user was saved
      // Use direct DB access for verification since we're testing the UoW abstraction
      const db = getDb();
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
        const userRepo1 = uow.getRepository(AUTH_USER_REPO_TOKEN);
        const userRepo2 = uow.getRepository(AUTH_USER_REPO_TOKEN);
        const quizRepo1 = uow.getRepository(QUIZ_REPO_TOKEN);
        const quizRepo2 = uow.getRepository(QUIZ_REPO_TOKEN);

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

        const userResult = AuthUser.fromPersistence(userData);
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
