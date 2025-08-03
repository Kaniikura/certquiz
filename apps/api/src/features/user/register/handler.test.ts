/**
 * Register handler tests
 * @fileoverview Tests for user registration business logic
 */
import { Email } from '@api/features/auth/domain/value-objects/Email';
import type { UserId } from '@api/features/auth/domain/value-objects/UserId';
import { UserRole } from '@api/features/auth/domain/value-objects/UserRole';
import { ValidationError } from '@api/shared/errors';
import { TestClock } from '@api/test-support/utils/TestClock';
import { beforeEach, describe, expect, it } from 'vitest';
import type { User } from '../domain/entities/User';
import type { IUserRepository } from '../domain/repositories/IUserRepository';
import { EmailAlreadyTakenError, UsernameAlreadyTakenError } from '../shared/errors';
import { registerHandler } from './handler';

// Mock repository for testing
class MockUserRepository implements IUserRepository {
  private users = new Map<string, User>();
  private emails = new Set<string>();
  private usernames = new Set<string>();

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
    this.emails.add(user.email.toString());
    this.usernames.add(user.username);
  }

  async create(user: User): Promise<void> {
    if (this.emails.has(user.email.toString())) {
      throw new EmailAlreadyTakenError(user.email.toString());
    }
    if (this.usernames.has(user.username)) {
      throw new UsernameAlreadyTakenError(user.username);
    }
    await this.save(user);
  }

  async updateProgress(user: User): Promise<void> {
    await this.save(user);
  }

  async isEmailTaken(email: Email, excludeUserId?: UserId): Promise<boolean> {
    if (excludeUserId) {
      // For updates, exclude the current user
      for (const user of this.users.values()) {
        if (
          user.email.toString() === email.toString() &&
          user.id.toString() !== excludeUserId.toString()
        ) {
          return true;
        }
      }
      return false;
    }
    return this.emails.has(email.toString());
  }

  async isUsernameTaken(username: string, excludeUserId?: UserId): Promise<boolean> {
    if (excludeUserId) {
      // For updates, exclude the current user
      for (const user of this.users.values()) {
        if (user.username === username && user.id.toString() !== excludeUserId.toString()) {
          return true;
        }
      }
      return false;
    }
    return this.usernames.has(username);
  }

  async withTransaction<T>(fn: (repo: IUserRepository) => Promise<T>): Promise<T> {
    return await fn(this);
  }

  async getAverageLevel(): Promise<number> {
    if (this.users.size === 0) return 0;
    let totalLevel = 0;
    for (const user of this.users.values()) {
      totalLevel += user.progress.level.value;
    }
    return totalLevel / this.users.size;
  }

  async getTotalExperience(): Promise<number> {
    let totalExp = 0;
    for (const user of this.users.values()) {
      totalExp += user.progress.experience.value;
    }
    return totalExp;
  }

  // Helper methods for testing
  addExistingEmail(email: string) {
    this.emails.add(email);
  }

  addExistingUsername(username: string) {
    this.usernames.add(username);
  }

  clear() {
    this.users.clear();
    this.emails.clear();
    this.usernames.clear();
  }
}

describe('registerHandler', () => {
  let mockRepository: MockUserRepository;
  let clock: TestClock;

  beforeEach(() => {
    mockRepository = new MockUserRepository();
    clock = new TestClock(new Date('2025-01-01T12:00:00Z'));
  });

  describe('successful registration', () => {
    it('should create a new user with default progress', async () => {
      const input = {
        email: 'john@example.com',
        username: 'john_doe',
        identityProviderId: 'auth0|123',
        role: 'user',
      };

      const result = await registerHandler(input, mockRepository, clock);

      expect(result.success).toBe(true);
      if (result.success) {
        const response = result.data;
        expect(response.user.email).toBe('john@example.com');
        expect(response.user.username).toBe('john_doe');
        expect(response.user.role).toBe(UserRole.User);
        expect(response.user.isActive).toBe(true);
        expect(response.user.progress.level).toBe(1);
        expect(response.user.progress.experience).toBe(0);
        expect(response.user.progress.currentStreak).toBe(0);
      }
    });

    it('should create user with default role when not specified', async () => {
      const input = {
        email: 'jane@example.com',
        username: 'jane_doe',
      };

      const result = await registerHandler(input, mockRepository, clock);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.user.role).toBe(UserRole.User);
      }
    });

    it('should create user without identity provider ID', async () => {
      const input = {
        email: 'simple@example.com',
        username: 'simple_user',
        role: 'premium',
      };

      const result = await registerHandler(input, mockRepository, clock);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.user.role).toBe(UserRole.Premium);
      }
    });
  });

  describe('validation errors', () => {
    it('should fail with invalid email', async () => {
      const input = {
        email: 'invalid-email',
        username: 'valid_user',
      };

      const result = await registerHandler(input, mockRepository, clock);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(ValidationError);
      }
    });

    it('should fail with invalid username', async () => {
      const input = {
        email: 'valid@example.com',
        username: 'a', // Too short
      };

      const result = await registerHandler(input, mockRepository, clock);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(ValidationError);
      }
    });

    it('should fail with username containing invalid characters', async () => {
      const input = {
        email: 'valid@example.com',
        username: 'invalid@username',
      };

      const result = await registerHandler(input, mockRepository, clock);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(ValidationError);
      }
    });

    it('should fail with missing required fields', async () => {
      const input = {
        email: 'valid@example.com',
        // Missing username
      };

      const result = await registerHandler(input, mockRepository, clock);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(ValidationError);
      }
    });
  });

  describe('business rule violations', () => {
    it('should fail when email is already taken', async () => {
      mockRepository.addExistingEmail('taken@example.com');

      const input = {
        email: 'taken@example.com',
        username: 'new_user',
      };

      const result = await registerHandler(input, mockRepository, clock);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(EmailAlreadyTakenError);
        expect(result.error.message).toContain('taken@example.com');
      }
    });

    it('should fail when username is already taken', async () => {
      mockRepository.addExistingUsername('taken_user');

      const input = {
        email: 'new@example.com',
        username: 'taken_user',
      };

      const result = await registerHandler(input, mockRepository, clock);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(UsernameAlreadyTakenError);
        expect(result.error.message).toContain('taken_user');
      }
    });
  });

  describe('edge cases', () => {
    it('should handle null input gracefully', async () => {
      const result = await registerHandler(null, mockRepository, clock);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(ValidationError);
      }
    });

    it('should handle undefined input gracefully', async () => {
      const result = await registerHandler(undefined, mockRepository, clock);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(ValidationError);
      }
    });

    it('should handle malformed input gracefully', async () => {
      const input = 'not an object';

      const result = await registerHandler(input, mockRepository, clock);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(ValidationError);
      }
    });
  });

  describe('repository integration', () => {
    it('should call repository create method', async () => {
      const input = {
        email: 'repo@example.com',
        username: 'repo_user',
      };

      const result = await registerHandler(input, mockRepository, clock);

      expect(result.success).toBe(true);

      // Verify user was actually saved
      const emailResult = Email.create('repo@example.com');
      if (!emailResult.success) throw new Error('Failed to create email');
      const savedUser = await mockRepository.findByEmail(emailResult.data);
      expect(savedUser).toBeDefined();
      expect(savedUser?.username).toBe('repo_user');
    });
  });
});
