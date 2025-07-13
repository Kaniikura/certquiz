/**
 * User entity unit tests
 * @fileoverview Pure unit tests for User domain entity
 */

import { ValidationError } from '@api/shared/errors';
import { unwrapOrFail } from '@api/test-support';
import { beforeEach, describe, expect, it } from 'vitest';
import { UserId } from '../value-objects/UserId';
import { UserRole } from '../value-objects/UserRole';
import { User } from './User';

// Local test utilities for auth domain (keeping for future use)
// const testAuthIds = {
//   userId: (id = 'user-123'): UserId => UserId.of(id),
// };

describe('User', () => {
  describe('create', () => {
    it('should create a user with valid inputs', () => {
      // Arrange & Act
      const result = User.create({
        email: 'test@example.com',
        username: 'testuser',
      });

      // Assert
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.email.toString()).toBe('test@example.com');
        expect(result.data.username).toBe('testuser');
        expect(result.data.role).toBe(UserRole.User);
        expect(result.data.isActive).toBe(true);
        expect(result.data.keycloakId).toBeNull();
      }
    });

    it('should create a user with optional role and keycloakId', () => {
      // Arrange & Act
      const result = User.create({
        email: 'admin@example.com',
        username: 'admin',
        role: UserRole.Admin,
        keycloakId: 'kc-123',
      });

      // Assert
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.role).toBe(UserRole.Admin);
        expect(result.data.keycloakId).toBe('kc-123');
      }
    });

    it('should fail with invalid email', () => {
      // Arrange & Act
      const result = User.create({
        email: 'invalid-email',
        username: 'testuser',
      });

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(ValidationError);
        expect(result.error.message).toContain('email');
      }
    });

    it('should fail with username too short', () => {
      // Arrange & Act
      const result = User.create({
        email: 'test@example.com',
        username: 'a',
      });

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(ValidationError);
        expect(result.error.message).toContain('2 and 50 characters');
      }
    });

    it('should fail with username too long', () => {
      // Arrange & Act
      const result = User.create({
        email: 'test@example.com',
        username: 'a'.repeat(51),
      });

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(ValidationError);
        expect(result.error.message).toContain('2 and 50 characters');
      }
    });

    it('should fail with invalid username characters', () => {
      // Arrange & Act
      const result = User.create({
        email: 'test@example.com',
        username: 'user@name',
      });

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(ValidationError);
        expect(result.error.message).toContain('letters, numbers, underscores, and hyphens');
      }
    });

    it('should trim whitespace from username', () => {
      // Arrange & Act
      const result = User.create({
        email: 'test@example.com',
        username: '  testuser  ',
      });

      // Assert
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.username).toBe('testuser');
      }
    });
  });

  describe('fromPersistence', () => {
    it('should restore user from database row', () => {
      // Arrange
      const row = {
        userId: 'test-user-id',
        email: 'test@example.com',
        username: 'testuser',
        role: 'user',
        keycloakId: 'kc-123',
        isActive: true,
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-02'),
      };

      // Act
      const result = User.fromPersistence(row);

      // Assert
      expect(result.success).toBe(true);
      if (result.success) {
        const user = result.data;
        expect(UserId.toString(user.id)).toBe(row.userId);
        expect(user.email.toString()).toBe('test@example.com');
        expect(user.username).toBe('testuser');
        expect(user.role).toBe(UserRole.User);
        expect(user.keycloakId).toBe('kc-123');
        expect(user.isActive).toBe(true);
        expect(user.createdAt).toEqual(new Date('2024-01-01'));
        expect(user.updatedAt).toEqual(new Date('2024-01-02'));
      }
    });

    it('should return error for invalid email in database', () => {
      // Arrange
      const row = {
        userId: 'test-user-id',
        email: 'invalid-email',
        username: 'testuser',
        role: 'user',
        keycloakId: null,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Act
      const result = User.fromPersistence(row);

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(ValidationError);
        expect(result.error.message).toBe('Invalid email in database: invalid-email');
      }
    });
  });

  describe('toPersistence', () => {
    it('should convert user to database row', () => {
      // Arrange
      const user = unwrapOrFail(
        User.create({
          email: 'test@example.com',
          username: 'testuser',
          role: UserRole.Premium,
          keycloakId: 'kc-123',
        })
      );

      // Act
      const row = user.toPersistence();

      // Assert
      expect(row.userId).toBe(UserId.toString(user.id));
      expect(row.email).toBe('test@example.com');
      expect(row.username).toBe('testuser');
      expect(row.role).toBe('premium');
      expect(row.keycloakId).toBe('kc-123');
      expect(row.isActive).toBe(true);
      expect(row.createdAt).toBeInstanceOf(Date);
      expect(row.updatedAt).toBeInstanceOf(Date);
    });
  });

  describe('updateProfile', () => {
    let user: User;

    beforeEach(() => {
      user = unwrapOrFail(
        User.create({
          email: 'test@example.com',
          username: 'testuser',
        })
      );
    });

    it('should update email successfully', async () => {
      // Arrange - small delay to ensure timestamp difference
      await new Promise((resolve) => setTimeout(resolve, 1));

      // Act
      const result = user.updateProfile({ email: 'newemail@example.com' });

      // Assert
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.email.toString()).toBe('newemail@example.com');
        expect(result.data.username).toBe('testuser'); // unchanged
        expect(result.data.updatedAt.getTime()).toBeGreaterThanOrEqual(user.updatedAt.getTime());
      }
    });

    it('should update username successfully', async () => {
      // Arrange - small delay to ensure timestamp difference
      await new Promise((resolve) => setTimeout(resolve, 1));

      // Act
      const result = user.updateProfile({ username: 'newusername' });

      // Assert
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.email.toString()).toBe('test@example.com'); // unchanged
        expect(result.data.username).toBe('newusername');
        expect(result.data.updatedAt.getTime()).toBeGreaterThanOrEqual(user.updatedAt.getTime());
      }
    });

    it('should update both email and username', () => {
      // Act
      const result = user.updateProfile({
        email: 'newemail@example.com',
        username: 'newusername',
      });

      // Assert
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.email.toString()).toBe('newemail@example.com');
        expect(result.data.username).toBe('newusername');
      }
    });

    it('should fail with invalid email', () => {
      // Act
      const result = user.updateProfile({ email: 'invalid-email' });

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(ValidationError);
      }
    });

    it('should fail with invalid username', () => {
      // Act
      const result = user.updateProfile({ username: 'a' });

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(ValidationError);
      }
    });
  });

  describe('deactivate', () => {
    it('should deactivate user', async () => {
      // Arrange
      const user = unwrapOrFail(
        User.create({
          email: 'test@example.com',
          username: 'testuser',
        })
      );

      // Small delay to ensure timestamp difference
      await new Promise((resolve) => setTimeout(resolve, 1));

      // Act
      const result = user.deactivate();

      // Assert
      expect(result.success).toBe(true);
      if (result.success) {
        const deactivatedUser = result.data;
        expect(deactivatedUser.isActive).toBe(false);
        expect(deactivatedUser.email.toString()).toBe('test@example.com'); // unchanged
        expect(deactivatedUser.username).toBe('testuser'); // unchanged
        expect(deactivatedUser.updatedAt.getTime()).toBeGreaterThanOrEqual(
          user.updatedAt.getTime()
        );
      }
    });
  });

  describe('hasPermission', () => {
    it('should return true for user role checking user permission', () => {
      // Arrange
      const user = unwrapOrFail(
        User.create({
          email: 'test@example.com',
          username: 'testuser',
          role: UserRole.User,
        })
      );

      // Act & Assert
      expect(user.hasPermission(UserRole.User)).toBe(true);
    });

    it('should return true for admin checking user permission', () => {
      // Arrange
      const user = unwrapOrFail(
        User.create({
          email: 'admin@example.com',
          username: 'admin',
          role: UserRole.Admin,
        })
      );

      // Act & Assert
      expect(user.hasPermission(UserRole.User)).toBe(true);
    });

    it('should return false for user checking admin permission', () => {
      // Arrange
      const user = unwrapOrFail(
        User.create({
          email: 'test@example.com',
          username: 'testuser',
          role: UserRole.User,
        })
      );

      // Act & Assert
      expect(user.hasPermission(UserRole.Admin)).toBe(false);
    });
  });

  describe('isAdmin', () => {
    it('should return true for admin user', () => {
      // Arrange
      const user = unwrapOrFail(
        User.create({
          email: 'admin@example.com',
          username: 'admin',
          role: UserRole.Admin,
        })
      );

      // Act & Assert
      expect(user.isAdmin()).toBe(true);
    });

    it('should return false for non-admin user', () => {
      // Arrange
      const user = unwrapOrFail(
        User.create({
          email: 'test@example.com',
          username: 'testuser',
          role: UserRole.User,
        })
      );

      // Act & Assert
      expect(user.isAdmin()).toBe(false);
    });
  });

  describe('isPremium', () => {
    it('should return true for premium user', () => {
      // Arrange
      const user = unwrapOrFail(
        User.create({
          email: 'premium@example.com',
          username: 'premium',
          role: UserRole.Premium,
        })
      );

      // Act & Assert
      expect(user.isPremium()).toBe(true);
    });

    it('should return true for admin user (admin is premium)', () => {
      // Arrange
      const user = unwrapOrFail(
        User.create({
          email: 'admin@example.com',
          username: 'admin',
          role: UserRole.Admin,
        })
      );

      // Act & Assert
      expect(user.isPremium()).toBe(true);
    });

    it('should return false for regular user', () => {
      // Arrange
      const user = unwrapOrFail(
        User.create({
          email: 'test@example.com',
          username: 'testuser',
          role: UserRole.User,
        })
      );

      // Act & Assert
      expect(user.isPremium()).toBe(false);
    });
  });

  describe('AggregateRoot behavior', () => {
    it('should have proper id handling from AggregateRoot', () => {
      // Arrange
      const user = unwrapOrFail(
        User.create({
          email: 'test@example.com',
          username: 'testuser',
        })
      );

      // Act & Assert
      expect(typeof user.id).toBe('string'); // UserId is a branded string
      expect(UserId.toString(user.id)).toBeTruthy();
    });

    it('should support equality comparison', () => {
      // Arrange
      const user1 = unwrapOrFail(
        User.create({
          email: 'test@example.com',
          username: 'testuser',
        })
      );
      const user2 = unwrapOrFail(
        User.fromPersistence({
          userId: UserId.toString(user1.id),
          email: 'test@example.com',
          username: 'testuser',
          role: 'user',
          keycloakId: null,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
      );

      // Act & Assert
      expect(UserId.equals(user1.id, user2.id)).toBe(true);
      expect(UserId.equals(user1.id, user1.id)).toBe(true);
    });
  });
});
