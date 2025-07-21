import type { User } from '../entities/User';
import type { Email, UserId } from '../value-objects';

/**
 * User repository interface for user domain
 * Handles rich User aggregate with progress tracking
 */
export interface IUserRepository {
  /**
   * Find user by ID including progress
   */
  findById(id: UserId): Promise<User | null>;

  /**
   * Find user by email including progress
   */
  findByEmail(email: Email): Promise<User | null>;

  /**
   * Find user by identity provider ID including progress
   */
  findByIdentityProviderId(identityProviderId: string): Promise<User | null>;

  /**
   * Find user by username including progress
   */
  findByUsername(username: string): Promise<User | null>;

  /**
   * Save user (insert or update both auth and progress)
   * Uses transaction to ensure consistency
   */
  save(user: User): Promise<void>;

  /**
   * Create new user with default progress
   * Uses transaction to create both auth and progress records
   */
  create(user: User): Promise<void>;

  /**
   * Update user progress only (for performance when auth data unchanged)
   */
  updateProgress(user: User): Promise<void>;

  /**
   * Check if email is already taken by another user
   */
  isEmailTaken(email: Email, excludeUserId?: UserId): Promise<boolean>;

  /**
   * Check if username is already taken by another user
   */
  isUsernameTaken(username: string, excludeUserId?: UserId): Promise<boolean>;

  /**
   * Execute operation within transaction
   */
  withTransaction<T>(fn: (repo: IUserRepository) => Promise<T>): Promise<T>;
}
