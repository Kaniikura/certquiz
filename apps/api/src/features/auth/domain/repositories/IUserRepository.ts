import type { User } from '../entities/User';
import type { Email } from '../value-objects/Email';
import type { UserId } from '../value-objects/UserId';

/**
 * User repository interface - domain layer
 * Follows repository pattern with domain focus
 */
export interface IUserRepository {
  /**
   * Find user by ID
   */
  findById(id: UserId): Promise<User | null>;

  /**
   * Find user by email
   */
  findByEmail(email: Email): Promise<User | null>;

  /**
   * Find user by KeyCloak ID
   */
  findByKeycloakId(keycloakId: string): Promise<User | null>;

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
}
