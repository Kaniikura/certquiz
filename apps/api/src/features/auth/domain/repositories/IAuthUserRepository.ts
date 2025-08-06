import type { User } from '../entities/User';
import type { Email } from '../value-objects/Email';
import type { UserId } from '../value-objects/UserId';
import type { UserRole } from '../value-objects/UserRole';

/**
 * Pagination parameters for user listing
 */
export interface UserPaginationParams {
  page: number;
  pageSize: number;
  filters?: {
    search?: string;
    role?: UserRole;
    isActive?: boolean;
  };
  orderBy?: 'createdAt' | 'email' | 'username';
  orderDir?: 'asc' | 'desc';
}

/**
 * Paginated result for user listing
 */
export interface PaginatedUserResult {
  items: User[];
  total: number;
  page: number;
  pageSize: number;
}

/**
 * Auth user repository interface - domain layer
 * Follows repository pattern with domain focus
 */
export interface IAuthUserRepository {
  /**
   * Find user by ID
   */
  findById(id: UserId): Promise<User | null>;

  /**
   * Find user by email
   */
  findByEmail(email: Email): Promise<User | null>;

  /**
   * Find user by identity provider ID
   */
  findByIdentityProviderId(identityProviderId: string): Promise<User | null>;

  /**
   * Find user by username
   */
  findByUsername(username: string): Promise<User | null>;

  /**
   * Save user (insert or update)
   */
  save(user: User): Promise<void>;

  /**
   * Check if email is already taken by another user
   */
  isEmailTaken(email: Email, excludeUserId?: UserId): Promise<boolean>;

  /**
   * Check if username is already taken by another user
   */
  isUsernameTaken(username: string, excludeUserId?: UserId): Promise<boolean>;

  /**
   * Admin statistics: Count total number of users
   */
  countTotalUsers(): Promise<number>;

  /**
   * Admin statistics: Count active users (logged in recently)
   * @param since - Optional date to count users active since
   */
  countActiveUsers(since?: Date): Promise<number>;

  /**
   * Admin management: Find all users with pagination
   * @param params - Pagination parameters including filters and sorting
   * @returns Paginated user results
   */
  findAllPaginated(params: UserPaginationParams): Promise<PaginatedUserResult>;

  /**
   * Update user's last login timestamp
   */
  updateLastLoginAt(userId: UserId): Promise<void>;

  /**
   * Admin management: Update user role
   * @param userId - The user ID to update
   * @param role - New role to assign
   * @param updatedBy - Admin user ID who is making the change
   */
  updateRole(userId: UserId, role: string, updatedBy: string): Promise<void>;
}
