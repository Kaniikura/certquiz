import type { Email } from '@api/features/auth/domain/value-objects/Email';
import type { UserId } from '@api/features/auth/domain/value-objects/UserId';
import { authUser } from '@api/features/auth/infrastructure/drizzle/schema/authUser';
import type { TransactionContext } from '@api/infra/unit-of-work';
import type { LoggerPort } from '@api/shared/logger/LoggerPort';
import { BaseRepository } from '@api/shared/repository/BaseRepository';
import { and, eq, ne } from 'drizzle-orm';
import type { User } from '../../domain/entities/User';
import type { IUserRepository } from '../../domain/repositories/IUserRepository';
import {
  isPgUniqueViolation,
  mapPgUniqueViolationToDomainError,
  type PostgresError,
} from '../../shared/postgres-errors';
import { userProgress } from './schema/userProgress';
import { mapJoinedRowToUser } from './UserRowMapper';

/**
 * Drizzle implementation of User repository for user domain
 * Handles rich User aggregate with progress tracking across two tables
 * Uses transactions to ensure consistency between authUser and userProgress
 */
export class DrizzleUserRepository extends BaseRepository implements IUserRepository {
  private readonly validRoles = ['guest', 'user', 'premium', 'admin'] as const;

  constructor(
    private readonly conn: TransactionContext,
    logger: LoggerPort
  ) {
    super(logger);
  }

  /**
   * Validate and cast role string to union type
   */
  private validateAndCastRole(role: string): 'guest' | 'user' | 'premium' | 'admin' {
    if (!this.validRoles.includes(role as 'guest' | 'user' | 'premium' | 'admin')) {
      throw new Error(
        `Invalid role value: ${role}. Valid roles are: ${this.validRoles.join(', ')}`
      );
    }
    return role as 'guest' | 'user' | 'premium' | 'admin';
  }

  /**
   * Common select fields for user queries with joined progress data
   */
  private getUserSelectFields() {
    return {
      // Auth user fields
      userId: authUser.userId,
      email: authUser.email,
      username: authUser.username,
      role: authUser.role,
      identityProviderId: authUser.identityProviderId,
      isActive: authUser.isActive,
      createdAt: authUser.createdAt,
      updatedAt: authUser.updatedAt,
      // Progress fields
      level: userProgress.level,
      experience: userProgress.experience,
      totalQuestions: userProgress.totalQuestions,
      correctAnswers: userProgress.correctAnswers,
      accuracy: userProgress.accuracy,
      studyTimeMinutes: userProgress.studyTimeMinutes,
      currentStreak: userProgress.currentStreak,
      lastStudyDate: userProgress.lastStudyDate,
      categoryStats: userProgress.categoryStats,
      progressUpdatedAt: userProgress.updatedAt,
    };
  }

  async findById(id: UserId): Promise<User | null> {
    try {
      const rows = await this.conn
        .select(this.getUserSelectFields())
        .from(authUser)
        .innerJoin(userProgress, eq(authUser.userId, userProgress.userId))
        .where(eq(authUser.userId, id))
        .limit(1);

      if (rows.length === 0) {
        return null;
      }

      const result = mapJoinedRowToUser(rows[0]);
      if (!result.success) {
        this.logger.error('Invalid user data in database', {
          userId: id,
          error: result.error.message,
        });
        throw result.error;
      }
      return result.data;
    } catch (error) {
      this.logger.error('Failed to find user by ID', {
        userId: id,
        error: this.getErrorDetails(error),
      });
      throw error;
    }
  }

  async findByEmail(email: Email): Promise<User | null> {
    try {
      const rows = await this.conn
        .select(this.getUserSelectFields())
        .from(authUser)
        .innerJoin(userProgress, eq(authUser.userId, userProgress.userId))
        .where(eq(authUser.email, email.toString()))
        .limit(1);

      if (rows.length === 0) {
        return null;
      }

      const result = mapJoinedRowToUser(rows[0]);
      if (!result.success) {
        this.logger.error('Invalid user data in database', {
          email: email.toString(),
          error: result.error.message,
        });
        throw result.error;
      }
      return result.data;
    } catch (error) {
      this.logger.error('Failed to find user by email', {
        email: email.toString(),
        error: this.getErrorDetails(error),
      });
      throw error;
    }
  }

  async findByIdentityProviderId(identityProviderId: string): Promise<User | null> {
    try {
      const rows = await this.conn
        .select(this.getUserSelectFields())
        .from(authUser)
        .innerJoin(userProgress, eq(authUser.userId, userProgress.userId))
        .where(eq(authUser.identityProviderId, identityProviderId))
        .limit(1);

      if (rows.length === 0) {
        return null;
      }

      const result = mapJoinedRowToUser(rows[0]);
      if (!result.success) {
        this.logger.error('Invalid user data in database', {
          identityProviderId,
          error: result.error.message,
        });
        throw result.error;
      }
      return result.data;
    } catch (error) {
      this.logger.error('Failed to find user by identity provider ID', {
        identityProviderId,
        error: this.getErrorDetails(error),
      });
      throw error;
    }
  }

  async findByUsername(username: string): Promise<User | null> {
    try {
      const rows = await this.conn
        .select(this.getUserSelectFields())
        .from(authUser)
        .innerJoin(userProgress, eq(authUser.userId, userProgress.userId))
        .where(eq(authUser.username, username))
        .limit(1);

      if (rows.length === 0) {
        return null;
      }

      const result = mapJoinedRowToUser(rows[0]);
      if (!result.success) {
        this.logger.error('Invalid user data in database', {
          username,
          error: result.error.message,
        });
        throw result.error;
      }
      return result.data;
    } catch (error) {
      this.logger.error('Failed to find user by username', {
        username,
        error: this.getErrorDetails(error),
      });
      throw error;
    }
  }

  async save(user: User): Promise<void> {
    try {
      const { authRow, progressRow } = user.toPersistence();

      // Execute both upserts within a single transaction to ensure atomicity
      await this.withTransaction(async (txRepo) => {
        // Transaction repository is properly typed as DrizzleUserRepository<Tx>
        // No unsafe casting needed - type safety guaranteed by withTransaction signature

        // Upsert auth user
        await txRepo.conn
          .insert(authUser)
          .values({
            userId: authRow.userId,
            email: authRow.email,
            username: authRow.username,
            role: txRepo.validateAndCastRole(authRow.role),
            identityProviderId: authRow.identityProviderId,
            isActive: authRow.isActive,
            createdAt: authRow.createdAt,
            updatedAt: authRow.updatedAt,
          })
          .onConflictDoUpdate({
            target: authUser.userId,
            set: {
              email: authRow.email,
              username: authRow.username,
              role: txRepo.validateAndCastRole(authRow.role),
              identityProviderId: authRow.identityProviderId,
              isActive: authRow.isActive,
              updatedAt: authRow.updatedAt,
            },
          });

        // Upsert user progress
        await txRepo.conn
          .insert(userProgress)
          .values({
            userId: authRow.userId,
            level: progressRow.level,
            experience: progressRow.experience,
            totalQuestions: progressRow.totalQuestions,
            correctAnswers: progressRow.correctAnswers,
            accuracy: progressRow.accuracy,
            studyTimeMinutes: progressRow.studyTimeMinutes,
            currentStreak: progressRow.currentStreak,
            lastStudyDate: progressRow.lastStudyDate,
            categoryStats: progressRow.categoryStats,
            updatedAt: progressRow.updatedAt,
          })
          .onConflictDoUpdate({
            target: userProgress.userId,
            set: {
              level: progressRow.level,
              experience: progressRow.experience,
              totalQuestions: progressRow.totalQuestions,
              correctAnswers: progressRow.correctAnswers,
              accuracy: progressRow.accuracy,
              studyTimeMinutes: progressRow.studyTimeMinutes,
              currentStreak: progressRow.currentStreak,
              lastStudyDate: progressRow.lastStudyDate,
              categoryStats: progressRow.categoryStats,
              updatedAt: progressRow.updatedAt,
            },
          });
      });

      this.logger.info('User saved successfully', {
        userId: authRow.userId,
        username: authRow.username,
      });
    } catch (error) {
      this.logger.error('Failed to save user', {
        userId: user.id,
        error: this.getErrorDetails(error),
      });
      throw error;
    }
  }

  async create(user: User): Promise<void> {
    try {
      const { authRow, progressRow } = user.toPersistence();

      // Execute both inserts within a single transaction to ensure atomicity
      await this.withTransaction(async (txRepo) => {
        // Transaction repository is properly typed as DrizzleUserRepository<Tx>
        // No unsafe casting needed - type safety guaranteed by withTransaction signature

        // Insert auth user
        await txRepo.conn.insert(authUser).values({
          userId: authRow.userId,
          email: authRow.email,
          username: authRow.username,
          role: txRepo.validateAndCastRole(authRow.role),
          identityProviderId: authRow.identityProviderId,
          isActive: authRow.isActive,
          createdAt: authRow.createdAt,
          updatedAt: authRow.updatedAt,
        });

        // Insert user progress with default values
        await txRepo.conn.insert(userProgress).values({
          userId: authRow.userId,
          level: progressRow.level,
          experience: progressRow.experience,
          totalQuestions: progressRow.totalQuestions,
          correctAnswers: progressRow.correctAnswers,
          accuracy: progressRow.accuracy,
          studyTimeMinutes: progressRow.studyTimeMinutes,
          currentStreak: progressRow.currentStreak,
          lastStudyDate: progressRow.lastStudyDate,
          categoryStats: progressRow.categoryStats,
          updatedAt: progressRow.updatedAt,
        });
      });

      this.logger.info('User created successfully', {
        userId: authRow.userId,
        username: authRow.username,
      });
    } catch (error) {
      // Debug: Log the full error structure to understand what we're dealing with
      if (process.env.NODE_ENV === 'development') {
        const pgError = error as PostgresError;
        this.logger.debug('Create user error details', {
          errorType: error?.constructor?.name,
          errorMessage: error instanceof Error ? error.message : String(error),
          errorCode: pgError?.code,
          errorCause: pgError?.cause,
          errorConstraint: pgError?.constraint,
          errorDetail: pgError?.detail,
        });
      }

      // Check if it's a PostgreSQL unique constraint violation
      if (isPgUniqueViolation(error)) {
        // Map to appropriate domain error (EmailAlreadyTakenError or UsernameAlreadyTakenError)
        const domainError = mapPgUniqueViolationToDomainError(error);
        this.logger.warn('User creation failed due to duplicate constraint', {
          userId: user.id,
          error: this.getErrorDetails(domainError),
        });
        throw domainError;
      }

      // For other errors, log and re-throw as-is
      this.logger.error('Failed to create user', {
        userId: user.id,
        error: this.getErrorDetails(error),
      });
      throw error;
    }
  }

  async updateProgress(user: User): Promise<void> {
    try {
      const { progressRow } = user.toPersistence();

      await this.conn
        .update(userProgress)
        .set({
          level: progressRow.level,
          experience: progressRow.experience,
          totalQuestions: progressRow.totalQuestions,
          correctAnswers: progressRow.correctAnswers,
          accuracy: progressRow.accuracy,
          studyTimeMinutes: progressRow.studyTimeMinutes,
          currentStreak: progressRow.currentStreak,
          lastStudyDate: progressRow.lastStudyDate,
          categoryStats: progressRow.categoryStats,
          updatedAt: progressRow.updatedAt,
        })
        .where(eq(userProgress.userId, user.id));

      this.logger.info('User progress updated successfully', {
        userId: user.id,
      });
    } catch (error) {
      this.logger.error('Failed to update user progress', {
        userId: user.id,
        error: this.getErrorDetails(error),
      });
      throw error;
    }
  }

  async isEmailTaken(email: Email, excludeUserId?: UserId): Promise<boolean> {
    try {
      const conditions = [eq(authUser.email, email.toString())];

      if (excludeUserId) {
        conditions.push(ne(authUser.userId, excludeUserId));
      }

      const rows = await this.conn
        .select({ count: authUser.userId })
        .from(authUser)
        .where(and(...conditions))
        .limit(1);

      return rows.length > 0;
    } catch (error) {
      this.logger.error('Failed to check if email is taken', {
        email: email.toString(),
        error: this.getErrorDetails(error),
      });
      throw error;
    }
  }

  async isUsernameTaken(username: string, excludeUserId?: UserId): Promise<boolean> {
    try {
      const conditions = [eq(authUser.username, username)];

      if (excludeUserId) {
        conditions.push(ne(authUser.userId, excludeUserId));
      }

      const rows = await this.conn
        .select({ count: authUser.userId })
        .from(authUser)
        .where(and(...conditions))
        .limit(1);

      return rows.length > 0;
    } catch (error) {
      this.logger.error('Failed to check if username is taken', {
        username,
        error: this.getErrorDetails(error),
      });
      throw error;
    }
  }

  async withTransaction<T>(fn: (repo: DrizzleUserRepository) => Promise<T>): Promise<T> {
    // For now, delegate to the connection's transaction method
    // This assumes the connection supports transactions
    if ('transaction' in this.conn && typeof this.conn.transaction === 'function') {
      return await this.conn.transaction(async (tx) => {
        const txRepo = new DrizzleUserRepository(tx, this.logger);
        return await fn(txRepo);
      });
    } else {
      throw new Error(
        'Transaction support is required but not available on database connection. ' +
          'Ensure your database connection is properly configured with transaction support.'
      );
    }
  }
}
