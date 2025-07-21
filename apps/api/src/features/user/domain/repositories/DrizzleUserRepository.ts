import type { Queryable } from '@api/infra/db/client';
import { authUser, userProgress } from '@api/infra/db/schema/user';
import type { LoggerPort } from '@api/shared/logger/LoggerPort';
import { BaseRepository } from '@api/shared/repository/BaseRepository';
import { and, eq, ne } from 'drizzle-orm';
import { User } from '../entities/User';
import type { Email, UserId } from '../value-objects';
import type { IUserRepository } from './IUserRepository';

/**
 * Drizzle implementation of User repository for user domain
 * Handles rich User aggregate with progress tracking across two tables
 * Uses transactions to ensure consistency between authUser and userProgress
 */
export class DrizzleUserRepository<TConnection extends Queryable>
  extends BaseRepository
  implements IUserRepository
{
  constructor(
    private readonly conn: TConnection,
    logger: LoggerPort
  ) {
    super(logger);
  }

  async findById(id: UserId): Promise<User | null> {
    try {
      const rows = await this.conn
        .select({
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
        })
        .from(authUser)
        .innerJoin(userProgress, eq(authUser.userId, userProgress.userId))
        .where(eq(authUser.userId, id))
        .limit(1);

      if (rows.length === 0) {
        return null;
      }

      return this.mapRowToUser(rows[0]);
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
        .select({
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
        })
        .from(authUser)
        .innerJoin(userProgress, eq(authUser.userId, userProgress.userId))
        .where(eq(authUser.email, email.toString()))
        .limit(1);

      if (rows.length === 0) {
        return null;
      }

      return this.mapRowToUser(rows[0]);
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
        .select({
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
        })
        .from(authUser)
        .innerJoin(userProgress, eq(authUser.userId, userProgress.userId))
        .where(eq(authUser.identityProviderId, identityProviderId))
        .limit(1);

      if (rows.length === 0) {
        return null;
      }

      return this.mapRowToUser(rows[0]);
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
        .select({
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
        })
        .from(authUser)
        .innerJoin(userProgress, eq(authUser.userId, userProgress.userId))
        .where(eq(authUser.username, username))
        .limit(1);

      if (rows.length === 0) {
        return null;
      }

      return this.mapRowToUser(rows[0]);
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

      // Upsert auth user
      await this.conn
        .insert(authUser)
        .values({
          userId: authRow.userId,
          email: authRow.email,
          username: authRow.username,
          role: authRow.role as 'guest' | 'user' | 'premium' | 'admin',
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
            role: authRow.role as 'guest' | 'user' | 'premium' | 'admin',
            identityProviderId: authRow.identityProviderId,
            isActive: authRow.isActive,
            updatedAt: authRow.updatedAt,
          },
        });

      // Upsert user progress
      await this.conn
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

      // Insert auth user
      await this.conn.insert(authUser).values({
        userId: authRow.userId,
        email: authRow.email,
        username: authRow.username,
        role: authRow.role as 'guest' | 'user' | 'premium' | 'admin',
        identityProviderId: authRow.identityProviderId,
        isActive: authRow.isActive,
        createdAt: authRow.createdAt,
        updatedAt: authRow.updatedAt,
      });

      // Insert user progress
      await this.conn.insert(userProgress).values({
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

      this.logger.info('User created successfully', {
        userId: authRow.userId,
        username: authRow.username,
      });
    } catch (error) {
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

  async withTransaction<T>(fn: (repo: IUserRepository) => Promise<T>): Promise<T> {
    // For now, delegate to the connection's transaction method
    // This assumes the connection supports transactions
    if ('transaction' in this.conn && typeof this.conn.transaction === 'function') {
      // biome-ignore lint/suspicious/noExplicitAny: Dynamic transaction support requires any casting
      return await (this.conn as any).transaction(async (tx: any) => {
        const txRepo = new DrizzleUserRepository(tx, this.logger);
        return await fn(txRepo);
      });
    } else {
      // Fallback if transaction not supported (shouldn't happen with proper Drizzle setup)
      return await fn(this);
    }
  }

  /**
   * Map joined database row to User domain entity
   */
  // biome-ignore lint/suspicious/noExplicitAny: Database row can have varying structure
  private mapRowToUser(row: any): User {
    const authRow = {
      userId: row.userId,
      email: row.email,
      username: row.username,
      role: row.role,
      identityProviderId: row.identityProviderId,
      isActive: row.isActive,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };

    const progressRow = {
      level: row.level,
      experience: row.experience,
      totalQuestions: row.totalQuestions,
      correctAnswers: row.correctAnswers,
      accuracy: row.accuracy,
      studyTimeMinutes: row.studyTimeMinutes,
      currentStreak: row.currentStreak,
      lastStudyDate: row.lastStudyDate,
      categoryStats: row.categoryStats,
      updatedAt: row.progressUpdatedAt,
    };

    const result = User.fromPersistence(authRow, progressRow);
    if (!result.success) {
      this.logger.error('Invalid user data in database', {
        userId: row.userId,
        error: result.error.message,
      });
      throw new Error(`Invalid user data in database: ${result.error.message}`);
    }

    return result.data;
  }
}
