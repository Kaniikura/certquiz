/**
 * Tests for FakeUnitOfWork implementation
 */

import { User } from '@api/features/auth/domain/entities/User';
import { Email } from '@api/features/auth/domain/value-objects/Email';
import { UserId } from '@api/features/auth/domain/value-objects/UserId';
import type { IUnitOfWork } from '@api/infra/db/IUnitOfWork';
import {
  FakeUnitOfWork,
  FakeUnitOfWorkFactory,
  FakeUserRepository,
  withFakeUnitOfWork,
} from '@api/test-utils/fakes';
import { beforeEach, describe, expect, it } from 'vitest';

// Test helper function to create test users with less boilerplate
function createTestUser(
  overrides: Partial<{
    userId: string;
    email: string;
    username: string;
    role: 'user' | 'admin' | 'premium';
    identityProviderId: string | null;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
  }> = {}
): User {
  const userData = {
    userId: UserId.generate(),
    email: 'test@example.com',
    username: 'testuser',
    role: 'user' as const,
    identityProviderId: null,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };

  const result = User.fromPersistence(userData);
  if (!result.success) {
    throw new Error('Failed to create test user');
  }
  return result.data;
}

describe('FakeUnitOfWork', () => {
  let factory: FakeUnitOfWorkFactory;
  let uow: FakeUnitOfWork;

  beforeEach(() => {
    factory = new FakeUnitOfWorkFactory();
    factory.clear();
    uow = factory.create();
  });

  describe('Transaction Management', () => {
    it('should start a transaction with begin()', async () => {
      expect(uow.isInTransaction()).toBe(false);
      await uow.begin();
      expect(uow.isInTransaction()).toBe(true);
    });

    it('should commit a transaction', async () => {
      await uow.begin();
      expect(uow.hasCommitted()).toBe(false);
      await uow.commit();
      expect(uow.hasCommitted()).toBe(true);
      expect(uow.isInTransaction()).toBe(false);
    });

    it('should rollback a transaction', async () => {
      await uow.begin();
      expect(uow.hasRolledBack()).toBe(false);
      await uow.rollback();
      expect(uow.hasRolledBack()).toBe(true);
      expect(uow.isInTransaction()).toBe(false);
    });

    it('should throw error if begin() called twice', async () => {
      await uow.begin();
      await expect(uow.begin()).rejects.toThrow('Transaction already active');
    });

    it('should throw error if commit() called without begin()', async () => {
      await expect(uow.commit()).rejects.toThrow('No active transaction');
    });

    it('should throw error if rollback() called without begin()', async () => {
      await expect(uow.rollback()).rejects.toThrow('No active transaction');
    });
  });

  describe('Repository Access', () => {
    it('should provide access to user repository', () => {
      const userRepo = uow.getUserRepository();
      expect(userRepo).toBeDefined();
      expect(userRepo).toBeInstanceOf(FakeUserRepository);
    });

    it('should provide access to quiz repository', () => {
      const quizRepo = uow.getQuizRepository();
      expect(quizRepo).toBeDefined();
    });

    it('should return the same repository instance on multiple calls', () => {
      const userRepo1 = uow.getUserRepository();
      const userRepo2 = uow.getUserRepository();
      expect(userRepo1).toBe(userRepo2);
    });
  });

  describe('FakeUserRepository', () => {
    let userRepo: FakeUserRepository;
    let testUser: User;

    beforeEach(() => {
      userRepo = factory.getUserRepository();
      testUser = createTestUser();
    });

    it('should save and retrieve user by id', async () => {
      await userRepo.save(testUser);
      const found = await userRepo.findById(testUser.id);
      expect(found).toBeDefined();
      expect(found?.id).toEqual(testUser.id);
    });

    it('should save and retrieve user by email', async () => {
      await userRepo.save(testUser);
      const found = await userRepo.findByEmail(testUser.email);
      expect(found).toBeDefined();
      expect(found?.email).toEqual(testUser.email);
    });

    it('should save and retrieve user by username', async () => {
      await userRepo.save(testUser);
      const found = await userRepo.findByUsername(testUser.username);
      expect(found).toBeDefined();
      expect(found?.username).toEqual(testUser.username);
    });

    it('should check if email is taken', async () => {
      await userRepo.save(testUser);
      const isTaken = await userRepo.isEmailTaken(testUser.email);
      expect(isTaken).toBe(true);

      const otherEmailResult = Email.create('other@example.com');
      expect(otherEmailResult.success).toBe(true);
      if (!otherEmailResult.success) {
        throw new Error('Failed to create email');
      }
      const notTaken = await userRepo.isEmailTaken(otherEmailResult.data);
      expect(notTaken).toBe(false);
    });

    it('should check if username is taken', async () => {
      await userRepo.save(testUser);
      const isTaken = await userRepo.isUsernameTaken(testUser.username);
      expect(isTaken).toBe(true);

      const notTaken = await userRepo.isUsernameTaken('otherusername');
      expect(notTaken).toBe(false);
    });

    it('should clear all users', async () => {
      await userRepo.save(testUser);
      expect(userRepo.getAll()).toHaveLength(1);

      userRepo.clear();
      expect(userRepo.getAll()).toHaveLength(0);

      const found = await userRepo.findById(testUser.id);
      expect(found).toBeNull();
    });
  });

  describe('withFakeUnitOfWork', () => {
    it('should execute callback with unit of work', async () => {
      let capturedUow: IUnitOfWork | undefined;
      const result = await withFakeUnitOfWork(factory, async (uow) => {
        capturedUow = uow;
        return 'success';
      });

      expect(result).toBe('success');
      expect(capturedUow).toBeDefined();
      expect(capturedUow).toBeInstanceOf(FakeUnitOfWork);
    });

    it('should commit on success', async () => {
      const uowRef = await withFakeUnitOfWork(factory, async (uow) => {
        return uow as FakeUnitOfWork;
      });

      expect(uowRef.hasCommitted()).toBe(true);
      expect(uowRef.hasRolledBack()).toBe(false);
    });

    it('should rollback on error', async () => {
      let uowRef: FakeUnitOfWork | undefined;

      await expect(
        withFakeUnitOfWork(factory, async (uow) => {
          uowRef = uow as FakeUnitOfWork;
          throw new Error('Test error');
        })
      ).rejects.toThrow('Test error');

      expect(uowRef).toBeDefined();
      expect(uowRef?.hasCommitted()).toBe(false);
      expect(uowRef?.hasRolledBack()).toBe(true);
    });

    it('should persist data across unit of work instances', async () => {
      // Save a user in one UoW
      const user = createTestUser({
        email: 'persist@example.com',
        username: 'persistuser',
      });

      await withFakeUnitOfWork(factory, async (uow) => {
        const userRepo = uow.getUserRepository();
        await userRepo.save(user);
      });

      // Find the user in another UoW
      const foundUser = await withFakeUnitOfWork(factory, async (uow) => {
        const userRepo = uow.getUserRepository();
        return userRepo.findById(user.id);
      });

      expect(foundUser).toBeDefined();
      expect(foundUser?.email.toString()).toBe('persist@example.com');
    });
  });
});
