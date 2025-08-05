import { User } from '@api/features/auth/domain/entities/User';
import type {
  IAuthUserRepository,
  PaginatedUserResult,
  UserPaginationParams,
} from '@api/features/auth/domain/repositories/IAuthUserRepository';
import type { Email } from '@api/features/auth/domain/value-objects/Email';
import { UserId } from '@api/features/auth/domain/value-objects/UserId';
import { UserRole } from '@api/features/auth/domain/value-objects/UserRole';

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

  async findAllPaginated(params: UserPaginationParams): Promise<PaginatedUserResult> {
    const { page = 1, pageSize = 20, filters, orderBy = 'createdAt', orderDir = 'desc' } = params;

    // Convert Map to array for filtering and sorting
    let users = Array.from(this.users.values());

    // Apply filters
    if (filters) {
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        users = users.filter(
          (user) =>
            user.email.toString().toLowerCase().includes(searchLower) ||
            user.username.toLowerCase().includes(searchLower)
        );
      }

      if (filters.role !== undefined) {
        users = users.filter((user) => user.role === filters.role);
      }

      if (filters.isActive !== undefined) {
        users = users.filter((user) => user.isActive === filters.isActive);
      }
    }

    // Sort users
    users.sort((a, b) => {
      let compareValue = 0;
      switch (orderBy) {
        case 'email':
          compareValue = a.email.toString().localeCompare(b.email.toString());
          break;
        case 'username':
          compareValue = a.username.localeCompare(b.username);
          break;
        default:
          compareValue = a.createdAt.getTime() - b.createdAt.getTime();
          break;
      }
      return orderDir === 'desc' ? -compareValue : compareValue;
    });

    // Calculate pagination
    const total = users.length;
    const startIndex = (page - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    const paginatedUsers = users.slice(startIndex, endIndex);

    return {
      items: paginatedUsers,
      total,
      page,
      pageSize,
    };
  }

  async updateLastLoginAt(userId: UserId): Promise<void> {
    const user = await this.findById(userId);
    if (!user) {
      throw new Error(`User not found: ${UserId.toString(userId)}`);
    }

    // Create updated user with new lastLoginAt
    const userPersistence = user.toPersistence();
    const updatedUserData = {
      ...userPersistence,
      lastLoginAt: new Date(),
      updatedAt: new Date(),
    };

    const updatedUserResult = User.fromPersistence(updatedUserData);
    if (!updatedUserResult.success) {
      throw updatedUserResult.error;
    }

    await this.save(updatedUserResult.data);
  }

  async updateRole(userId: string, role: string, _updatedBy: string): Promise<void> {
    const user = await this.findById(UserId.of(userId));
    if (!user) {
      throw new Error(`User not found: ${userId}`);
    }

    // Parse and validate the role
    const parsedRole = UserRole.fromString(role);

    // Create updated user with new role - User constructor is private,
    // so we need to create a new user from persistence data with updated role
    const userPersistence = user.toPersistence();
    const updatedUserData = {
      ...userPersistence,
      role: UserRole.roleToString(parsedRole),
      updatedAt: new Date(),
    };

    const updatedUserResult = User.fromPersistence(updatedUserData);
    if (!updatedUserResult.success) {
      throw updatedUserResult.error;
    }

    await this.save(updatedUserResult.data);
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
