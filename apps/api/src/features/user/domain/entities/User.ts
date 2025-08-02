import { AggregateRoot } from '@api/features/auth/domain/base/AggregateRoot';
import type { Clock } from '@api/shared/clock';
import { ValidationError } from '@api/shared/errors';
import { Result } from '@api/shared/result';
import { Email, UserId, UserRole } from '../value-objects';
import { UserProgress } from './UserProgress';

interface CreateUserProps {
  email: string;
  username: string;
  identityProviderId?: string;
  role?: UserRole;
}

interface QuizCompletionData {
  correctAnswers: number;
  totalQuestions: number;
  category: string;
  studyTimeMinutes: number;
}

interface AuthUserRow {
  userId: string;
  email: string;
  username: string;
  role: string;
  identityProviderId: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

interface UserProgressRow {
  level: number;
  experience: number;
  totalQuestions: number;
  correctAnswers: number;
  accuracy: string;
  studyTimeMinutes: number;
  currentStreak: number;
  lastStudyDate: Date | null;
  categoryStats: object;
  updatedAt: Date;
}

/**
 * User aggregate combining auth information with progress tracking
 * This is the main User entity for the user domain, separate from auth domain
 */
export class User extends AggregateRoot<UserId> {
  private constructor(
    id: UserId,
    public readonly email: Email,
    public readonly username: string,
    public readonly role: UserRole,
    public readonly identityProviderId: string | null,
    public readonly isActive: boolean,
    public readonly progress: UserProgress,
    public readonly createdAt: Date,
    public readonly updatedAt: Date
  ) {
    super(id);
  }

  /**
   * Create a new user with default progress
   */
  static create(props: CreateUserProps, clock: Clock): Result<User, ValidationError> {
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

    const now = clock.now();
    const defaultProgress = UserProgress.create(clock);

    return Result.ok(
      new User(
        UserId.generate(),
        emailResult.data,
        usernameResult.data,
        props.role ?? UserRole.User,
        props.identityProviderId ?? null,
        true, // isActive defaults to true
        defaultProgress,
        now, // createdAt
        now // updatedAt
      )
    );
  }

  /**
   * Restore user from database rows
   */
  static fromPersistence(
    authRow: AuthUserRow,
    progressRow: UserProgressRow
  ): Result<User, ValidationError> {
    // Validate email from persistence
    const email = Email.create(authRow.email);
    if (!email.success) {
      return Result.fail(new ValidationError(`Invalid email in database: ${authRow.email}`));
    }

    // Validate username from persistence
    const usernameResult = User.validateUsername(authRow.username);
    if (!usernameResult.success) {
      return Result.fail(new ValidationError(`Invalid username in database: ${authRow.username}`));
    }

    // Restore progress
    const progress = UserProgress.fromPersistence(progressRow);

    return Result.ok(
      new User(
        UserId.of(authRow.userId),
        email.data,
        usernameResult.data,
        UserRole.fromString(authRow.role),
        authRow.identityProviderId,
        authRow.isActive,
        progress,
        authRow.createdAt,
        authRow.updatedAt
      )
    );
  }

  /**
   * Complete a quiz and update progress
   */
  completeQuiz(quizData: QuizCompletionData, clock: Clock): User {
    const updatedProgress = this.progress.addQuizResult({
      correctAnswers: quizData.correctAnswers,
      totalQuestions: quizData.totalQuestions,
      category: quizData.category,
      studyTimeMinutes: quizData.studyTimeMinutes,
      clock,
    });

    return new User(
      this.id,
      this.email,
      this.username,
      this.role,
      this.identityProviderId,
      this.isActive,
      updatedProgress,
      this.createdAt,
      clock.now() // Update timestamp
    );
  }

  /**
   * Update user profile information
   */
  updateProfile(
    updates: { username?: string; email?: string },
    clock: Clock
  ): Result<User, ValidationError> {
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
        this.progress, // Progress unchanged
        this.createdAt,
        clock.now() // Updated timestamp
      )
    );
  }

  /**
   * Deactivate user
   */
  deactivate(clock: Clock): User {
    return new User(
      this.id,
      this.email,
      this.username,
      this.role,
      this.identityProviderId,
      false, // isActive = false
      this.progress, // Progress unchanged
      this.createdAt,
      clock.now() // Updated timestamp
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

  /**
   * Convert to database persistence format
   */
  toPersistence(): { authRow: AuthUserRow; progressRow: UserProgressRow } {
    const authRow: AuthUserRow = {
      userId: UserId.toString(this.id),
      email: this.email.toString(),
      username: this.username,
      role: UserRole.roleToString(this.role),
      identityProviderId: this.identityProviderId,
      isActive: this.isActive,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };

    const progressRow = this.progress.toPersistence();

    return { authRow, progressRow };
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
}
