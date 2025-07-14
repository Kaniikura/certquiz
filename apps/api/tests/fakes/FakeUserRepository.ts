/**
 * Fake User Repository for Testing
 * @fileoverview In-memory user repository that doesn't require database
 */

import type { User } from '@api/features/auth/domain/entities/User';
import type { IUserRepository } from '@api/features/auth/domain/repositories/IUserRepository';
import type { Email } from '@api/features/auth/domain/value-objects/Email';
import { UserId } from '@api/features/auth/domain/value-objects/UserId';

/**
 * In-memory user repository for testing
 * Provides full IUserRepository interface without database dependency
 */
export class FakeUserRepository implements IUserRepository {
  private users = new Map<string, User>();

  async findByEmail(email: Email): Promise<User | null> {
    return this.users.get(email.toString()) || null;
  }

  async findById(id: UserId): Promise<User | null> {
    for (const user of this.users.values()) {
      if (UserId.toString(user.id) === UserId.toString(id)) {
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
    this.users.set(user.email.toString(), user);
  }

  async isEmailTaken(email: Email): Promise<boolean> {
    return this.users.has(email.toString());
  }

  async isUsernameTaken(username: string): Promise<boolean> {
    for (const user of this.users.values()) {
      if (user.username === username) {
        return true;
      }
    }
    return false;
  }

  // Test helper methods

  /**
   * Add a user to the fake repository (test helper)
   */
  addUser(user: User): void {
    this.users.set(user.email.toString(), user);
  }

  /**
   * Clear all users from the fake repository (test helper)
   */
  clear(): void {
    this.users.clear();
  }

  /**
   * Get all users (test helper)
   */
  getAllUsers(): User[] {
    return Array.from(this.users.values());
  }

  /**
   * Get user count (test helper)
   */
  getUserCount(): number {
    return this.users.size;
  }
}
