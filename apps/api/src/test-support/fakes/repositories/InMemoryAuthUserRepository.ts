import type { User } from '@api/features/auth/domain/entities/User';
import type { IAuthUserRepository } from '@api/features/auth/domain/repositories/IAuthUserRepository';
import type { Email } from '@api/features/auth/domain/value-objects/Email';
import { UserId } from '@api/features/auth/domain/value-objects/UserId';

/**
 * In-memory auth user repository for testing
 * Provides full IUserRepository interface without database dependency
 */
export class InMemoryAuthUserRepository implements IAuthUserRepository {
  private users = new Map<string, User>();

  async findByEmail(email: Email): Promise<User | null> {
    return this.users.get(email.toString()) || null;
  }

  async findById(id: UserId): Promise<User | null> {
    const idString = UserId.toString(id);
    for (const user of this.users.values()) {
      if (UserId.toString(user.id) === idString) {
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

  countTotalUsers(): Promise<number> {
    return Promise.resolve(this.users.size);
  }

  countActiveUsers(since?: Date): Promise<number> {
    if (!since) {
      // If no date provided, assume all users are active
      return Promise.resolve(this.users.size);
    }

    // For testing purposes, we'll simulate that users have a lastActiveAt property
    // In real implementation, this would query based on login timestamps
    let activeCount = 0;
    for (const user of this.users.values()) {
      // For testing, we'll consider all users active if created after the given date
      // In real implementation, this would check last login time
      if (user.createdAt >= since) {
        activeCount++;
      }
    }
    return Promise.resolve(activeCount);
  }

  // Test helper methods

  /**
   * Add a user directly for testing
   */
  async addUser(user: User): Promise<void> {
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
  getAllUsers(): User[] {
    return Array.from(this.users.values());
  }

  /**
   * Get user count for testing
   */
  getUserCount(): number {
    return this.users.size;
  }
}
