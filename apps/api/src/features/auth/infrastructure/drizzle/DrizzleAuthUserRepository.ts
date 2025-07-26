import { authUser } from '@api/infra/db/schema/user';
import type { TransactionContext } from '@api/infra/unit-of-work';
import type { LoggerPort } from '@api/shared/logger/LoggerPort';
import { BaseRepository } from '@api/shared/repository/BaseRepository';
import { and, eq, ne } from 'drizzle-orm';
import { User } from '../../domain/entities/User';
import type { IUserRepository } from '../../domain/repositories/IUserRepository';
import type { Email } from '../../domain/value-objects/Email';
import type { UserId } from '../../domain/value-objects/UserId';

/**
 * Drizzle implementation of User repository
 * Uses Queryable interface to work with both DB client and transactions
 */
export class DrizzleAuthUserRepository extends BaseRepository implements IUserRepository {
  constructor(
    private readonly conn: TransactionContext,
    logger: LoggerPort
  ) {
    super(logger);
  }

  async findById(id: UserId): Promise<User | null> {
    try {
      const row = await this.conn.select().from(authUser).where(eq(authUser.userId, id)).limit(1);

      if (row.length === 0) {
        return null;
      }

      const result = User.fromPersistence(row[0]);
      if (!result.success) {
        this.logger.error('Invalid user data in database', {
          userId: id,
          error: result.error.message,
        });
        return null;
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
        .select()
        .from(authUser)
        .where(eq(authUser.email, email.toString()))
        .limit(1);

      if (rows.length === 0) {
        return null;
      }

      const result = User.fromPersistence(rows[0]);
      if (!result.success) {
        this.logger.error('Invalid user data in database:', {
          email: email.toString(),
          error: result.error.message,
        });
        return null;
      }

      return result.data;
    } catch (error) {
      this.logger.error('Failed to find user by email:', {
        email: email.toString(),
        error: this.getErrorDetails(error),
      });
      throw error;
    }
  }

  async findByIdentityProviderId(identityProviderId: string): Promise<User | null> {
    try {
      const row = await this.conn
        .select()
        .from(authUser)
        .where(eq(authUser.identityProviderId, identityProviderId))
        .limit(1);

      if (row.length === 0) {
        return null;
      }

      const result = User.fromPersistence(row[0]);
      if (!result.success) {
        this.logger.error('Invalid user data in database:', {
          identityProviderId,
          error: result.error.message,
        });
        return null;
      }

      return result.data;
    } catch (error) {
      this.logger.error('Failed to find user by identity provider ID:', {
        identityProviderId,
        error: this.getErrorDetails(error),
      });
      throw error;
    }
  }

  async findByUsername(username: string): Promise<User | null> {
    try {
      const row = await this.conn
        .select()
        .from(authUser)
        .where(eq(authUser.username, username))
        .limit(1);

      if (row.length === 0) {
        return null;
      }

      const result = User.fromPersistence(row[0]);
      if (!result.success) {
        this.logger.error('Invalid user data in database:', {
          username,
          error: result.error.message,
        });
        return null;
      }

      return result.data;
    } catch (error) {
      this.logger.error('Failed to find user by username:', {
        username,
        error: this.getErrorDetails(error),
      });
      throw error;
    }
  }

  async save(user: User): Promise<void> {
    try {
      const data = user.toPersistence();

      // Upsert: insert on conflict do update
      await this.conn
        .insert(authUser)
        .values({
          ...data,
          role: data.role as 'guest' | 'user' | 'premium' | 'admin',
        })
        .onConflictDoUpdate({
          target: authUser.userId,
          set: {
            email: data.email,
            username: data.username,
            role: data.role as 'guest' | 'user' | 'premium' | 'admin',
            identityProviderId: data.identityProviderId,
            isActive: data.isActive,
            updatedAt: data.updatedAt,
          },
        });

      this.logger.info('User saved successfully', {
        userId: data.userId,
        username: data.username,
      });
    } catch (error) {
      this.logger.error('Failed to save user:', {
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

      const row = await this.conn
        .select({ count: authUser.userId })
        .from(authUser)
        .where(and(...conditions))
        .limit(1);

      return row.length > 0;
    } catch (error) {
      this.logger.error('Failed to check if email is taken:', {
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

      const row = await this.conn
        .select({ count: authUser.userId })
        .from(authUser)
        .where(and(...conditions))
        .limit(1);

      return row.length > 0;
    } catch (error) {
      this.logger.error('Failed to check if username is taken:', {
        username,
        error: this.getErrorDetails(error),
      });
      throw error;
    }
  }
}
