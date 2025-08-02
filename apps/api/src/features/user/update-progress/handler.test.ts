/**
 * Update progress handler tests
 * @fileoverview Tests for user progress update business logic
 */

import { ValidationError } from '@api/shared/errors';
import { beforeEach, describe, expect, it } from 'vitest';
import { TestClock } from '@/test-support';
import { User } from '../domain/entities/User';
import type { IUserRepository } from '../domain/repositories/IUserRepository';
import { type Email, type UserId, UserRole } from '../domain/value-objects';
import { UserNotFoundError } from '../shared/errors';
import { updateProgressHandler } from './handler';

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
    return false; // Not used in update progress tests
  }

  async isUsernameTaken(_username: string, _excludeUserId?: UserId): Promise<boolean> {
    return false; // Not used in update progress tests
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

describe('updateProgressHandler', () => {
  let mockRepository: MockUserRepository;
  let clock: TestClock;
  let existingUser: User;

  beforeEach(() => {
    mockRepository = new MockUserRepository();
    clock = new TestClock(new Date('2025-01-01T12:00:00Z'));

    // Create a test user
    const userResult = User.create(
      {
        email: 'test@example.com',
        username: 'test_user',
        role: UserRole.User,
      },
      clock
    );
    if (!userResult.success) throw new Error('Failed to create test user');
    existingUser = userResult.data;

    mockRepository.addUser(existingUser);
  });

  describe('successful progress updates', () => {
    it('should update user progress with quiz results', async () => {
      const input = {
        userId: existingUser.id.toString(),
        correctAnswers: 8,
        totalQuestions: 10,
        category: 'CCNA',
        studyTimeMinutes: 30,
      };

      const result = await updateProgressHandler(input, mockRepository, clock);

      expect(result.success).toBe(true);
      if (result.success) {
        const response = result.data;
        expect(response.progress.totalQuestions).toBe(10);
        expect(response.progress.correctAnswers).toBe(8);
        expect(response.progress.accuracy).toBe(80);
        expect(response.progress.studyTimeMinutes).toBe(30);
        expect(response.progress.currentStreak).toBe(1);
        expect(response.progress.level).toBe(1); // New user starts at level 1
        expect(response.progress.experience).toBeGreaterThan(0);
        expect(response.progress.categoryStats.CCNA).toEqual({
          correct: 8,
          total: 10,
          accuracy: 80,
        });
      }
    });

    it('should handle perfect quiz scores', async () => {
      const input = {
        userId: existingUser.id.toString(),
        correctAnswers: 10,
        totalQuestions: 10,
        category: 'CCNP',
        studyTimeMinutes: 45,
      };

      const result = await updateProgressHandler(input, mockRepository, clock);

      expect(result.success).toBe(true);
      if (result.success) {
        const response = result.data;
        expect(response.progress.accuracy).toBe(100);
        expect(response.progress.categoryStats.CCNP).toEqual({
          correct: 10,
          total: 10,
          accuracy: 100,
        });
        // Perfect scores should give bonus XP
        expect(response.progress.experience).toBeGreaterThan(100); // Base + bonus
      }
    });

    it('should update streak correctly on consecutive days', async () => {
      // First quiz on day 1
      let input = {
        userId: existingUser.id.toString(),
        correctAnswers: 5,
        totalQuestions: 10,
        category: 'Security',
        studyTimeMinutes: 20,
      };

      let result = await updateProgressHandler(input, mockRepository, clock);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.progress.currentStreak).toBe(1);
      }

      // Advance to next day and take another quiz
      clock.advanceByDays(1);

      input = {
        userId: existingUser.id.toString(),
        correctAnswers: 7,
        totalQuestions: 10,
        category: 'Routing',
        studyTimeMinutes: 25,
      };

      result = await updateProgressHandler(input, mockRepository, clock);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.progress.currentStreak).toBe(2);
        expect(result.data.progress.totalQuestions).toBe(20); // Cumulative
        expect(result.data.progress.correctAnswers).toBe(12); // Cumulative
      }
    });

    it('should handle multiple categories', async () => {
      // First quiz in CCNA
      let input = {
        userId: existingUser.id.toString(),
        correctAnswers: 8,
        totalQuestions: 10,
        category: 'CCNA',
        studyTimeMinutes: 30,
      };

      let result = await updateProgressHandler(input, mockRepository, clock);
      expect(result.success).toBe(true);

      // Second quiz in CCNP
      input = {
        userId: existingUser.id.toString(),
        correctAnswers: 6,
        totalQuestions: 10,
        category: 'CCNP',
        studyTimeMinutes: 35,
      };

      result = await updateProgressHandler(input, mockRepository, clock);
      expect(result.success).toBe(true);
      if (result.success) {
        const response = result.data;
        expect(response.progress.categoryStats.CCNA).toEqual({
          correct: 8,
          total: 10,
          accuracy: 80,
        });
        expect(response.progress.categoryStats.CCNP).toEqual({
          correct: 6,
          total: 10,
          accuracy: 60,
        });
        expect(response.progress.totalQuestions).toBe(20);
        expect(response.progress.correctAnswers).toBe(14);
      }
    });
  });

  describe('validation errors', () => {
    it('should fail with invalid user ID format', async () => {
      const input = {
        userId: 'invalid-uuid',
        correctAnswers: 8,
        totalQuestions: 10,
        category: 'CCNA',
        studyTimeMinutes: 30,
      };

      const result = await updateProgressHandler(input, mockRepository, clock);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(ValidationError);
      }
    });

    it('should fail with negative correct answers', async () => {
      const input = {
        userId: existingUser.id.toString(),
        correctAnswers: -1,
        totalQuestions: 10,
        category: 'CCNA',
        studyTimeMinutes: 30,
      };

      const result = await updateProgressHandler(input, mockRepository, clock);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(ValidationError);
      }
    });

    it('should fail when correct answers exceed total questions', async () => {
      const input = {
        userId: existingUser.id.toString(),
        correctAnswers: 15,
        totalQuestions: 10,
        category: 'CCNA',
        studyTimeMinutes: 30,
      };

      const result = await updateProgressHandler(input, mockRepository, clock);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(ValidationError);
        expect(result.error.message).toContain('cannot exceed total questions');
      }
    });

    it('should fail with missing required fields', async () => {
      const input = {
        userId: existingUser.id.toString(),
        correctAnswers: 8,
        // Missing totalQuestions
        category: 'CCNA',
        studyTimeMinutes: 30,
      };

      const result = await updateProgressHandler(input, mockRepository, clock);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(ValidationError);
      }
    });

    it('should fail with excessive study time', async () => {
      const input = {
        userId: existingUser.id.toString(),
        correctAnswers: 8,
        totalQuestions: 10,
        category: 'CCNA',
        studyTimeMinutes: 1500, // More than 24 hours
      };

      const result = await updateProgressHandler(input, mockRepository, clock);

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
        correctAnswers: 8,
        totalQuestions: 10,
        category: 'CCNA',
        studyTimeMinutes: 30,
      };

      const result = await updateProgressHandler(input, mockRepository, clock);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(UserNotFoundError);
        expect(result.error.message).toContain('550e8400-e29b-41d4-a716-446655440000');
      }
    });
  });

  describe('edge cases', () => {
    it('should handle zero correct answers', async () => {
      const input = {
        userId: existingUser.id.toString(),
        correctAnswers: 0,
        totalQuestions: 10,
        category: 'CCNA',
        studyTimeMinutes: 30,
      };

      const result = await updateProgressHandler(input, mockRepository, clock);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.progress.accuracy).toBe(0);
        expect(result.data.progress.experience).toBeGreaterThan(0); // Should still get some XP
      }
    });

    it('should handle null input gracefully', async () => {
      const result = await updateProgressHandler(null, mockRepository, clock);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(ValidationError);
      }
    });

    it('should handle malformed input gracefully', async () => {
      const input = 'not an object';

      const result = await updateProgressHandler(input, mockRepository, clock);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(ValidationError);
      }
    });
  });

  describe('repository integration', () => {
    it('should call repository updateProgress method', async () => {
      const input = {
        userId: existingUser.id.toString(),
        correctAnswers: 8,
        totalQuestions: 10,
        category: 'CCNA',
        studyTimeMinutes: 30,
      };

      const result = await updateProgressHandler(input, mockRepository, clock);

      expect(result.success).toBe(true);

      // Verify user progress was actually updated in repository
      const updatedUser = await mockRepository.findById(existingUser.id);
      expect(updatedUser).toBeDefined();
      expect(updatedUser?.progress.totalQuestions).toBe(10);
      expect(updatedUser?.progress.correctAnswers).toBe(8);
    });
  });
});
