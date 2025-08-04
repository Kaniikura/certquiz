import { ValidationError } from '@api/shared/errors';
import { Result } from '@api/shared/result';
import { AggregateRoot } from '../base/AggregateRoot';
import { Email } from '../value-objects/Email';
import { UserId } from '../value-objects/UserId';
import { UserRole } from '../value-objects/UserRole';

/**
 * User entity - minimal implementation for auth
 * Follows the domain model design v2 principles
 */
export class User extends AggregateRoot<UserId> {
  private constructor(
    id: UserId,
    public readonly email: Email,
    public readonly username: string,
    public readonly role: UserRole,
    public readonly identityProviderId: string | null,
    public readonly isActive: boolean,
    public readonly createdAt: Date,
    public readonly updatedAt: Date,
    public readonly lastLoginAt: Date | null
  ) {
    super(id);
  }

  /**
   * Validate username input - extracted for reuse
   */
  private static validateUsername(username: string): Result<string, ValidationError> {
    const cleanUsername = username.trim();
    if (cleanUsername.length < 2 || cleanUsername.length > 50) {
      return Result.fail(new ValidationError('Username must be between 2 and 50 characters'));
    }
    if (!/^[a-zA-Z0-9_-]+$/.test(cleanUsername)) {
      return Result.fail(
        new ValidationError('Username can only contain letters, numbers, underscores, and hyphens')
      );
    }
    return Result.ok(cleanUsername);
  }

  /**
   * Factory method for creating new users
   */
  static create(props: {
    email: string;
    username: string;
    identityProviderId?: string;
    role?: UserRole;
  }): Result<User, ValidationError> {
    // Validate email
    const emailResult = Email.create(props.email);
    if (!emailResult.success) {
      return Result.fail(emailResult.error);
    }

    // Validate username
    const usernameResult = User.validateUsername(props.username);
    if (!usernameResult.success) {
      return Result.fail(usernameResult.error);
    }

    const now = new Date();

    return Result.ok(
      new User(
        UserId.generate(),
        emailResult.data,
        usernameResult.data,
        props.role ?? UserRole.User,
        props.identityProviderId ?? null,
        true, // isActive defaults to true
        now, // createdAt
        now, // updatedAt
        null // lastLoginAt - null for new users
      )
    );
  }

  /**
   * Restore from database row
   */
  static fromPersistence(row: {
    userId: string;
    email: string;
    username: string;
    role: string;
    identityProviderId: string | null;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
    lastLoginAt: Date | null;
  }): Result<User, ValidationError> {
    // Validate email even from persistence (data integrity check)
    const email = Email.create(row.email);
    if (!email.success) {
      return Result.fail(new ValidationError(`Invalid email in database: ${row.email}`));
    }

    // Validate username from persistence for consistency
    const usernameResult = User.validateUsername(row.username);
    if (!usernameResult.success) {
      return Result.fail(new ValidationError(`Invalid username in database: ${row.username}`));
    }

    return Result.ok(
      new User(
        UserId.of(row.userId),
        email.data,
        usernameResult.data,
        UserRole.fromString(row.role),
        row.identityProviderId,
        row.isActive,
        row.createdAt,
        row.updatedAt,
        row.lastLoginAt
      )
    );
  }

  /**
   * Convert to database row
   */
  toPersistence(): {
    userId: string;
    email: string;
    username: string;
    role: string;
    identityProviderId: string | null;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
    lastLoginAt: Date | null;
  } {
    return {
      userId: UserId.toString(this.id),
      email: this.email.toString(),
      username: this.username,
      role: UserRole.roleToString(this.role),
      identityProviderId: this.identityProviderId,
      isActive: this.isActive,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      lastLoginAt: this.lastLoginAt,
    };
  }

  /**
   * Update user with new data
   */
  updateProfile(updates: { username?: string; email?: string }): Result<User, ValidationError> {
    let newEmail = this.email;
    let newUsername = this.username;

    if (updates.email) {
      const emailResult = Email.create(updates.email);
      if (!emailResult.success) {
        return Result.fail(emailResult.error);
      }
      newEmail = emailResult.data;
    }

    if (updates.username) {
      const usernameResult = User.validateUsername(updates.username);
      if (!usernameResult.success) {
        return Result.fail(usernameResult.error);
      }
      newUsername = usernameResult.data;
    }

    return Result.ok(
      new User(
        this.id,
        newEmail,
        newUsername,
        this.role,
        this.identityProviderId,
        this.isActive,
        this.createdAt,
        new Date(), // Updated timestamp
        this.lastLoginAt // Preserve lastLoginAt
      )
    );
  }

  /**
   * Deactivate user
   */
  deactivate(): Result<User, never> {
    return Result.ok(
      new User(
        this.id,
        this.email,
        this.username,
        this.role,
        this.identityProviderId,
        false, // isActive = false
        this.createdAt,
        new Date(), // Updated timestamp
        this.lastLoginAt // Preserve lastLoginAt
      )
    );
  }

  /**
   * Update last login timestamp
   */
  updateLastLogin(): Result<User, never> {
    return Result.ok(
      new User(
        this.id,
        this.email,
        this.username,
        this.role,
        this.identityProviderId,
        this.isActive,
        this.createdAt,
        new Date(), // Updated timestamp
        new Date() // New lastLoginAt
      )
    );
  }

  /**
   * Check if user has permission for a role
   */
  hasPermission(requiredRole: UserRole): boolean {
    return UserRole.hasPermission(this.role, requiredRole);
  }

  /**
   * Check if user is admin
   */
  isAdmin(): boolean {
    return this.role === UserRole.Admin;
  }

  /**
   * Check if user is premium
   */
  isPremium(): boolean {
    return this.role === UserRole.Premium || this.role === UserRole.Admin;
  }
}
