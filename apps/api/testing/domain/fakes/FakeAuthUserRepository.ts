/**
 * Fake Auth User Repository for Testing
 * @fileoverview In-memory auth user repository that doesn't require database
 */

import type { AuthUser } from '@api/features/auth';
import type { Email, IUserRepository as IAuthUserRepository } from '@api/features/auth/domain';
import { UserId } from '@api/features/auth/domain';

/**
 * In-memory auth user repository for testing
 * Provides full IUserRepository interface without database dependency
 */
export class FakeAuthUserRepository implements IAuthUserRepository {
  private users = new Map<string, AuthUser>();

  async findByEmail(email: Email): Promise<AuthUser | null> {
    return this.users.get(email.toString()) || null;
  }

  async findById(id: UserId): Promise<AuthUser | null> {
    const idString = UserId.toString(id);
    for (const user of this.users.values()) {
      if (UserId.toString(user.id) === idString) {
        return user;
      }
    }
    return null;
  }

  async findByIdentityProviderId(identityProviderId: string): Promise<AuthUser | null> {
    for (const user of this.users.values()) {
      if (user.identityProviderId === identityProviderId) {
        return user;
      }
    }
    return null;
  }

  async findByUsername(username: string): Promise<AuthUser | null> {
    for (const user of this.users.values()) {
      if (user.username === username) {
        return user;
      }
    }
    return null;
  }

  async save(user: AuthUser): Promise<void> {
    this.users.set(user.email.toString(), user);
  }

  async isEmailTaken(email: Email, excludeUserId?: UserId): Promise<boolean> {
    const user = await this.findByEmail(email);
    if (!user) {
      return false;
    }
    if (excludeUserId && UserId.equals(user.id, excludeUserId)) {
      return false;
    }
    return true;
  }

  async isUsernameTaken(username: string, excludeUserId?: UserId): Promise<boolean> {
    const user = await this.findByUsername(username);
    if (!user) {
      return false;
    }
    if (excludeUserId && UserId.equals(user.id, excludeUserId)) {
      return false;
    }
    return true;
  }

  // Test helper methods

  /**
   * Add a user directly for testing
   */
  async addUser(user: AuthUser): Promise<void> {
    await this.save(user);
  }

  /**
   * Clear all users
   */
  clear(): void {
    this.users.clear();
  }

  /**
   * Get all users for testing
   */
  getAllUsers(): AuthUser[] {
    return Array.from(this.users.values());
  }

  /**
   * Get user count for testing
   */
  getUserCount(): number {
    return this.users.size;
  }
}
