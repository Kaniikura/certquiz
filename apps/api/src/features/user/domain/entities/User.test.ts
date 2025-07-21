import { ValidationError } from '@api/shared/errors';
import { TestClock } from '@api/test-support/TestClock';
import { describe, expect, it } from 'vitest';
import { Email, UserRole } from '../value-objects';
import { User } from './User';

describe('User', () => {
  describe('create', () => {
    it('should create a new user with default progress', () => {
      const clock = new TestClock(new Date('2025-01-01T12:00:00Z'));
      const emailResult = Email.create('john@example.com');
      if (!emailResult.success) throw new Error('Failed to create email');
      const email = emailResult.data;
      const result = User.create(
        {
          email: email.toString(),
          username: 'john_doe',
          identityProviderId: 'auth0|123',
          role: UserRole.User,
        },
        clock
      );

      expect(result.success).toBe(true);
      if (result.success) {
        const user = result.data;
        expect(user.email.toString()).toBe('john@example.com');
        expect(user.username).toBe('john_doe');
        expect(user.role).toBe(UserRole.User);
        expect(user.identityProviderId).toBe('auth0|123');
        expect(user.isActive).toBe(true);

        // Should have default progress
        expect(user.progress.level.value).toBe(1);
        expect(user.progress.experience.value).toBe(0);
        expect(user.progress.totalQuestions).toBe(0);
        expect(user.progress.currentStreak.days).toBe(0);
      }
    });

    it('should fail with invalid email', () => {
      const clock = new TestClock(new Date('2025-01-01T12:00:00Z'));
      const result = User.create(
        {
          email: 'invalid-email',
          username: 'john_doe',
        },
        clock
      );

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(ValidationError);
      }
    });
  });

  describe('fromPersistence', () => {
    it('should restore user from database rows', () => {
      const authRow = {
        userId: 'user-123',
        email: 'john@example.com',
        username: 'john_doe',
        role: 'user',
        identityProviderId: 'auth0|123',
        isActive: true,
        createdAt: new Date('2025-01-01T10:00:00Z'),
        updatedAt: new Date('2025-01-01T12:00:00Z'),
      };

      const progressRow = {
        level: 5,
        experience: 400,
        totalQuestions: 100,
        correctAnswers: 80,
        accuracy: '80.00',
        studyTimeMinutes: 120,
        currentStreak: 7,
        lastStudyDate: new Date('2025-01-01T12:00:00Z'),
        categoryStats: {
          version: 1,
          categories: {
            CCNA: { correct: 8, total: 10, accuracy: 80 },
          },
        },
        updatedAt: new Date('2025-01-01T12:00:00Z'),
      };

      const result = User.fromPersistence(authRow, progressRow);

      expect(result.success).toBe(true);
      if (result.success) {
        const user = result.data;
        expect(user.id.toString()).toBe('user-123');
        expect(user.email.toString()).toBe('john@example.com');
        expect(user.username).toBe('john_doe');
        expect(user.progress.level.value).toBe(5);
        expect(user.progress.experience.value).toBe(400);
        expect(user.progress.currentStreak.days).toBe(7);
      }
    });
  });

  describe('completeQuiz', () => {
    it('should update progress when quiz is completed', () => {
      const clock = new TestClock(new Date('2025-01-01T12:00:00Z'));
      const result = User.create(
        {
          email: 'john@example.com',
          username: 'john_doe',
        },
        clock
      );
      if (!result.success) throw new Error('Failed to create user');
      const user = result.data;

      const updatedUser = user.completeQuiz(
        {
          correctAnswers: 8,
          totalQuestions: 10,
          category: 'CCNA',
          studyTimeMinutes: 30,
        },
        clock
      );

      expect(updatedUser.progress.totalQuestions).toBe(10);
      expect(updatedUser.progress.correctAnswers).toBe(8);
      expect(updatedUser.progress.accuracy.value).toBe(80);
      expect(updatedUser.progress.studyTime.minutes).toBe(30);
      expect(updatedUser.progress.currentStreak.days).toBe(1);

      const ccnaStats = updatedUser.progress.categoryStats.getCategoryStats('CCNA');
      expect(ccnaStats).toEqual({
        correct: 8,
        total: 10,
        accuracy: 80,
      });
    });

    it('should update streak correctly over multiple days', () => {
      const clock = new TestClock(new Date('2025-01-01T12:00:00Z'));
      const result = User.create(
        {
          email: 'john@example.com',
          username: 'john_doe',
        },
        clock
      );
      if (!result.success) throw new Error('Failed to create user');
      const user = result.data;

      // Complete quiz on day 1
      const day1User = user.completeQuiz(
        {
          correctAnswers: 8,
          totalQuestions: 10,
          category: 'CCNA',
          studyTimeMinutes: 30,
        },
        clock
      );

      expect(day1User.progress.currentStreak.days).toBe(1);

      // Complete quiz on day 2
      clock.advanceByDays(1);
      const day2User = day1User.completeQuiz(
        {
          correctAnswers: 9,
          totalQuestions: 10,
          category: 'CCNP',
          studyTimeMinutes: 45,
        },
        clock
      );

      expect(day2User.progress.currentStreak.days).toBe(2);
      expect(day2User.progress.totalQuestions).toBe(20);
      expect(day2User.progress.correctAnswers).toBe(17);
    });
  });

  describe('updateProfile', () => {
    it('should update user profile information', () => {
      const clock = new TestClock(new Date('2025-01-01T12:00:00Z'));
      const createResult = User.create(
        {
          email: 'john@example.com',
          username: 'john_doe',
        },
        clock
      );
      if (!createResult.success) throw new Error('Failed to create user');
      const user = createResult.data;

      const result = user.updateProfile({
        username: 'john_smith',
        email: 'john.smith@example.com',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        const updatedUser = result.data;
        expect(updatedUser.username).toBe('john_smith');
        expect(updatedUser.email.toString()).toBe('john.smith@example.com');
        expect(updatedUser.progress).toBe(user.progress); // Progress unchanged
      }
    });

    it('should fail with invalid email', () => {
      const clock = new TestClock(new Date('2025-01-01T12:00:00Z'));
      const createResult = User.create(
        {
          email: 'john@example.com',
          username: 'john_doe',
        },
        clock
      );
      if (!createResult.success) throw new Error('Failed to create user');
      const user = createResult.data;

      const result = user.updateProfile({
        email: 'invalid-email',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(ValidationError);
      }
    });
  });

  describe('deactivate', () => {
    it('should deactivate user', () => {
      const clock = new TestClock(new Date('2025-01-01T12:00:00Z'));
      const result = User.create(
        {
          email: 'john@example.com',
          username: 'john_doe',
        },
        clock
      );
      if (!result.success) throw new Error('Failed to create user');
      const user = result.data;

      const deactivatedUser = user.deactivate();

      expect(deactivatedUser.isActive).toBe(false);
      expect(deactivatedUser.progress).toBe(user.progress); // Progress unchanged
    });
  });

  describe('business methods', () => {
    it('should check if user is premium', () => {
      const clock = new TestClock(new Date('2025-01-01T12:00:00Z'));
      const premiumResult = User.create(
        {
          email: 'premium@example.com',
          username: 'premium_user',
          role: UserRole.Premium,
        },
        clock
      );
      if (!premiumResult.success) throw new Error('Failed to create premium user');
      const premiumUser = premiumResult.data;

      const regularResult = User.create(
        {
          email: 'regular@example.com',
          username: 'regular_user',
          role: UserRole.User,
        },
        clock
      );
      if (!regularResult.success) throw new Error('Failed to create regular user');
      const regularUser = regularResult.data;

      expect(premiumUser.isPremium()).toBe(true);
      expect(regularUser.isPremium()).toBe(false);
    });

    it('should check if user is admin', () => {
      const clock = new TestClock(new Date('2025-01-01T12:00:00Z'));
      const adminResult = User.create(
        {
          email: 'admin@example.com',
          username: 'admin_user',
          role: UserRole.Admin,
        },
        clock
      );
      if (!adminResult.success) throw new Error('Failed to create admin user');
      const adminUser = adminResult.data;

      const regularResult = User.create(
        {
          email: 'regular@example.com',
          username: 'regular_user',
          role: UserRole.User,
        },
        clock
      );
      if (!regularResult.success) throw new Error('Failed to create regular user');
      const regularUser = regularResult.data;

      expect(adminUser.isAdmin()).toBe(true);
      expect(regularUser.isAdmin()).toBe(false);
    });
  });

  describe('toPersistence', () => {
    it('should convert to database row format', () => {
      const clock = new TestClock(new Date('2025-01-01T12:00:00Z'));
      const userResult = User.create(
        {
          email: 'john@example.com',
          username: 'john_doe',
          identityProviderId: 'auth0|123',
          role: UserRole.Premium,
        },
        clock
      );
      if (!userResult.success) throw new Error('Failed to create user');
      const user = userResult.data;

      const { authRow, progressRow } = user.toPersistence();

      expect(authRow.userId).toBe(user.id.toString());
      expect(authRow.email).toBe('john@example.com');
      expect(authRow.username).toBe('john_doe');
      expect(authRow.role).toBe('premium');
      expect(authRow.identityProviderId).toBe('auth0|123');
      expect(authRow.isActive).toBe(true);

      expect(progressRow.level).toBe(1);
      expect(progressRow.experience).toBe(0);
      expect(progressRow.totalQuestions).toBe(0);
      expect(progressRow.currentStreak).toBe(0);
    });
  });
});
