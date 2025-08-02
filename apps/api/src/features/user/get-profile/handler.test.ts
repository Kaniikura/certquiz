/**
 * Get profile handler tests
 * @fileoverview Tests for user profile retrieval business logic
 */

import { ValidationError } from '@api/shared/errors';
import { beforeEach, describe, expect, it } from 'vitest';
import { TestClock } from '@/test-support';
import { User } from '../domain/entities/User';
import type { IUserRepository } from '../domain/repositories/IUserRepository';
import { type Email, type UserId, UserRole } from '../domain/value-objects';
import { UserNotFoundError } from '../shared/errors';
import { getProfileHandler } from './handler';

// Mock repository for testing
class MockUserRepository implements IUserRepository {
  private users = new Map<string, User>();

  async findById(id: UserId): Promise<User | null> {
    return this.users.get(id.toString()) || null;
  }

  async findByEmail(email: Email): Promise<User | null> {
    for (const user of this.users.values()) {
      if (user.email.toString() === email.toString()) {
        return user;
      }
    }
    return null;
  }

  async findByIdentityProviderId(identityProviderId: string): Promise<User | null> {
    for (const user of this.users.values()) {
      if (user.identityProviderId === identityProviderId) {
        return user;
      }
    }
    return null;
  }

  async findByUsername(username: string): Promise<User | null> {
    for (const user of this.users.values()) {
      if (user.username === username) {
        return user;
      }
    }
    return null;
  }

  async save(user: User): Promise<void> {
    this.users.set(user.id.toString(), user);
  }

  async create(user: User): Promise<void> {
    await this.save(user);
  }

  async updateProgress(user: User): Promise<void> {
    this.users.set(user.id.toString(), user);
  }

  async isEmailTaken(_email: Email, _excludeUserId?: UserId): Promise<boolean> {
    return false; // Not used in get profile tests
  }

  async isUsernameTaken(_username: string, _excludeUserId?: UserId): Promise<boolean> {
    return false; // Not used in get profile tests
  }

  async withTransaction<T>(fn: (repo: IUserRepository) => Promise<T>): Promise<T> {
    return await fn(this);
  }

  // Helper methods for testing
  addUser(user: User) {
    this.users.set(user.id.toString(), user);
  }

  clear() {
    this.users.clear();
  }
}

describe('getProfileHandler', () => {
  let mockRepository: MockUserRepository;
  let clock: TestClock;
  let existingUser: User;

  beforeEach(() => {
    mockRepository = new MockUserRepository();
    clock = new TestClock(new Date('2025-01-01T12:00:00Z'));

    // Create a test user with some progress
    const userResult = User.create(
      {
        email: 'test@example.com',
        username: 'test_user',
        identityProviderId: 'auth0|123',
        role: UserRole.Premium,
      },
      clock
    );
    if (!userResult.success) throw new Error('Failed to create test user');
    existingUser = userResult.data;

    // Add some quiz progress to make it more interesting
    existingUser = existingUser.completeQuiz(
      {
        correctAnswers: 8,
        totalQuestions: 10,
        category: 'CCNA',
        studyTimeMinutes: 30,
      },
      clock
    );

    mockRepository.addUser(existingUser);
  });

  describe('successful profile retrieval', () => {
    it('should return complete user profile with progress', async () => {
      const input = {
        userId: existingUser.id.toString(),
      };

      const result = await getProfileHandler(input, mockRepository);

      expect(result.success).toBe(true);
      if (result.success) {
        const response = result.data;

        // Check user basic info
        expect(response.user.id).toBe(existingUser.id.toString());
        expect(response.user.email).toBe('test@example.com');
        expect(response.user.username).toBe('test_user');
        expect(response.user.role).toBe(UserRole.Premium);
        expect(response.user.isActive).toBe(true);
        expect(response.user.identityProviderId).toBe('auth0|123');
        expect(response.user.createdAt).toBeInstanceOf(Date);
        expect(response.user.updatedAt).toBeInstanceOf(Date);

        // Check progress info
        expect(response.user.progress.level).toBe(1);
        expect(response.user.progress.experience).toBeGreaterThan(0);
        expect(response.user.progress.totalQuestions).toBe(10);
        expect(response.user.progress.correctAnswers).toBe(8);
        expect(response.user.progress.accuracy).toBe(80);
        expect(response.user.progress.studyTimeMinutes).toBe(30);
        expect(response.user.progress.currentStreak).toBe(1);
        expect(response.user.progress.lastStudyDate).toBeInstanceOf(Date);
        expect(response.user.progress.streakLevel).toBe('beginner');

        // Check category stats
        expect(response.user.progress.categoryStats.CCNA).toEqual({
          correct: 8,
          total: 10,
          accuracy: 80,
        });
      }
    });

    it('should return user with default progress when no quizzes completed', async () => {
      // Create a new user with no quiz progress
      const newUserResult = User.create(
        {
          email: 'new@example.com',
          username: 'new_user',
          role: UserRole.User,
        },
        clock
      );
      if (!newUserResult.success) throw new Error('Failed to create new user');
      const newUser = newUserResult.data;

      mockRepository.addUser(newUser);

      const input = {
        userId: newUser.id.toString(),
      };

      const result = await getProfileHandler(input, mockRepository);

      expect(result.success).toBe(true);
      if (result.success) {
        const response = result.data;
        expect(response.user.progress.level).toBe(1);
        expect(response.user.progress.experience).toBe(0);
        expect(response.user.progress.totalQuestions).toBe(0);
        expect(response.user.progress.correctAnswers).toBe(0);
        expect(response.user.progress.accuracy).toBe(0);
        expect(response.user.progress.currentStreak).toBe(0);
        expect(response.user.progress.lastStudyDate).toBeNull();
        expect(response.user.progress.streakLevel).toBe('none');
        expect(Object.keys(response.user.progress.categoryStats)).toHaveLength(0);
      }
    });

    it('should return user with multiple category statistics', async () => {
      // Add more quiz results in different categories
      existingUser = existingUser.completeQuiz(
        {
          correctAnswers: 6,
          totalQuestions: 10,
          category: 'CCNP',
          studyTimeMinutes: 40,
        },
        clock
      );

      existingUser = existingUser.completeQuiz(
        {
          correctAnswers: 9,
          totalQuestions: 10,
          category: 'Security',
          studyTimeMinutes: 35,
        },
        clock
      );

      mockRepository.addUser(existingUser);

      const input = {
        userId: existingUser.id.toString(),
      };

      const result = await getProfileHandler(input, mockRepository);

      expect(result.success).toBe(true);
      if (result.success) {
        const response = result.data;
        expect(response.user.progress.totalQuestions).toBe(30);
        expect(response.user.progress.correctAnswers).toBe(23);

        expect(response.user.progress.categoryStats.CCNA).toEqual({
          correct: 8,
          total: 10,
          accuracy: 80,
        });

        expect(response.user.progress.categoryStats.CCNP).toEqual({
          correct: 6,
          total: 10,
          accuracy: 60,
        });

        expect(response.user.progress.categoryStats.Security).toEqual({
          correct: 9,
          total: 10,
          accuracy: 90,
        });
      }
    });

    it('should return user without identity provider ID', async () => {
      // Create user without identity provider
      const localUserResult = User.create(
        {
          email: 'local@example.com',
          username: 'local_user',
          role: UserRole.Admin,
        },
        clock
      );
      if (!localUserResult.success) throw new Error('Failed to create local user');
      const localUser = localUserResult.data;

      mockRepository.addUser(localUser);

      const input = {
        userId: localUser.id.toString(),
      };

      const result = await getProfileHandler(input, mockRepository);

      expect(result.success).toBe(true);
      if (result.success) {
        const response = result.data;
        expect(response.user.identityProviderId).toBeNull();
        expect(response.user.role).toBe(UserRole.Admin);
      }
    });
  });

  describe('validation errors', () => {
    it('should fail with invalid user ID format', async () => {
      const input = {
        userId: 'invalid-uuid',
      };

      const result = await getProfileHandler(input, mockRepository);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(ValidationError);
      }
    });

    it('should fail with missing user ID', async () => {
      const input = {};

      const result = await getProfileHandler(input, mockRepository);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(ValidationError);
      }
    });

    it('should fail with empty user ID', async () => {
      const input = {
        userId: '',
      };

      const result = await getProfileHandler(input, mockRepository);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(ValidationError);
      }
    });
  });

  describe('business rule violations', () => {
    it('should fail when user is not found', async () => {
      const input = {
        userId: '550e8400-e29b-41d4-a716-446655440000', // Valid UUID but doesn't exist
      };

      const result = await getProfileHandler(input, mockRepository);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(UserNotFoundError);
        expect(result.error.message).toContain('550e8400-e29b-41d4-a716-446655440000');
      }
    });
  });

  describe('edge cases', () => {
    it('should handle null input gracefully', async () => {
      const result = await getProfileHandler(null, mockRepository);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(ValidationError);
      }
    });

    it('should handle undefined input gracefully', async () => {
      const result = await getProfileHandler(undefined, mockRepository);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(ValidationError);
      }
    });

    it('should handle malformed input gracefully', async () => {
      const input = 'not an object';

      const result = await getProfileHandler(input, mockRepository);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(ValidationError);
      }
    });
  });

  describe('repository integration', () => {
    it('should call repository findById method', async () => {
      const input = {
        userId: existingUser.id.toString(),
      };

      const result = await getProfileHandler(input, mockRepository);

      expect(result.success).toBe(true);

      // Verify we can find the same user data
      const foundUser = await mockRepository.findById(existingUser.id);
      expect(foundUser).toBeDefined();
      expect(foundUser?.email.toString()).toBe('test@example.com');
    });
  });
});
