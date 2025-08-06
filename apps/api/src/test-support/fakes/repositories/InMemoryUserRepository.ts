import type { Email } from '@api/features/auth/domain/value-objects/Email';
import type { UserId } from '@api/features/auth/domain/value-objects/UserId';
import type { User } from '@api/features/user/domain/entities/User';
import type { IUserRepository } from '@api/features/user/domain/repositories/IUserRepository';
import {
  EmailAlreadyTakenError,
  UsernameAlreadyTakenError,
} from '@api/features/user/shared/errors';

/**
 * In-memory user repository for testing
 * Provides full IUserRepository interface without database dependency
 */
export class InMemoryUserRepository implements IUserRepository {
  private users = new Map<string, User>();

  async findByEmail(email: Email): Promise<User | null> {
    return this.users.get(email.toString()) || null;
  }

  async findById(id: UserId): Promise<User | null> {
    for (const user of this.users.values()) {
      if (user.id.toString() === id.toString()) {
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

  async create(user: User): Promise<void> {
    // Check if email is already taken
    const existingUserByEmail = await this.findByEmail(user.email);
    if (existingUserByEmail) {
      throw new EmailAlreadyTakenError(user.email.toString());
    }

    // Check if username is already taken
    const existingUserByUsername = await this.findByUsername(user.username);
    if (existingUserByUsername) {
      throw new UsernameAlreadyTakenError(user.username);
    }

    // Save the new user
    await this.save(user);
  }

  async updateProgress(user: User): Promise<void> {
    // For fake repository, just save the entire user object
    await this.save(user);
  }

  async withTransaction<T>(fn: (repo: IUserRepository) => Promise<T>): Promise<T> {
    // Fake repository doesn't need real transactions
    // Just execute the function with this repository
    return await fn(this);
  }

  async isEmailTaken(email: Email, excludeUserId?: UserId): Promise<boolean> {
    const user = await this.findByEmail(email);
    if (!user) {
      return false;
    }
    if (excludeUserId && user.id.toString() === excludeUserId.toString()) {
      return false;
    }
    return true;
  }

  async isUsernameTaken(username: string, excludeUserId?: UserId): Promise<boolean> {
    const user = await this.findByUsername(username);
    if (!user) {
      return false;
    }
    if (excludeUserId && user.id.toString() === excludeUserId.toString()) {
      return false;
    }
    return true;
  }

  async getAverageLevel(): Promise<number> {
    const users = Array.from(this.users.values());
    if (users.length === 0) {
      return 0;
    }

    const totalLevel = users.reduce((sum, user) => sum + user.progress.level.value, 0);
    return totalLevel / users.length;
  }

  async getTotalExperience(): Promise<number> {
    const users = Array.from(this.users.values());
    return users.reduce((sum, user) => sum + user.progress.experience.value, 0);
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
