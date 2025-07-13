import { authUser } from '@api/infra/db/schema/user';
import { and, eq, ne } from 'drizzle-orm';
import type { PostgresJsTransaction } from 'drizzle-orm/postgres-js';
import pino from 'pino';
import { User } from '../entities/User';
import type { Email } from '../value-objects/Email';
import type { UserId } from '../value-objects/UserId';
import type { IUserRepository } from './IUserRepository';

// Create logger for repository operations
const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  name: 'DrizzleUserRepository',
});

/**
 * Drizzle implementation of User repository
 * Uses transaction for consistency with other repositories
 */
export class DrizzleUserRepository implements IUserRepository {
  constructor(
    private readonly trx: PostgresJsTransaction<Record<string, never>, Record<string, never>>
  ) {}

  async findById(id: UserId): Promise<User | null> {
    try {
      const row = await this.trx.select().from(authUser).where(eq(authUser.userId, id)).limit(1);

      if (row.length === 0) {
        return null;
      }

      const result = User.fromPersistence(row[0]);
      if (!result.success) {
        logger.error('Invalid user data in database:', {
          userId: id,
          error: result.error.message,
        });
        return null;
      }

      return result.data;
    } catch (error) {
      logger.error('Failed to find user by ID:', {
        userId: id,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  async findByEmail(email: Email): Promise<User | null> {
    try {
      const row = await this.trx
        .select()
        .from(authUser)
        .where(eq(authUser.email, email.toString()))
        .limit(1);

      if (row.length === 0) {
        return null;
      }

      const result = User.fromPersistence(row[0]);
      if (!result.success) {
        logger.error('Invalid user data in database:', {
          email: email.toString(),
          error: result.error.message,
        });
        return null;
      }

      return result.data;
    } catch (error) {
      logger.error('Failed to find user by email:', {
        email: email.toString(),
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  async findByKeycloakId(keycloakId: string): Promise<User | null> {
    try {
      const row = await this.trx
        .select()
        .from(authUser)
        .where(eq(authUser.keycloakId, keycloakId))
        .limit(1);

      if (row.length === 0) {
        return null;
      }

      const result = User.fromPersistence(row[0]);
      if (!result.success) {
        logger.error('Invalid user data in database:', {
          keycloakId,
          error: result.error.message,
        });
        return null;
      }

      return result.data;
    } catch (error) {
      logger.error('Failed to find user by KeyCloak ID:', {
        keycloakId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  async findByUsername(username: string): Promise<User | null> {
    try {
      const row = await this.trx
        .select()
        .from(authUser)
        .where(eq(authUser.username, username))
        .limit(1);

      if (row.length === 0) {
        return null;
      }

      const result = User.fromPersistence(row[0]);
      if (!result.success) {
        logger.error('Invalid user data in database:', {
          username,
          error: result.error.message,
        });
        return null;
      }

      return result.data;
    } catch (error) {
      logger.error('Failed to find user by username:', {
        username,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  async save(user: User): Promise<void> {
    try {
      const data = user.toPersistence();

      // Upsert: insert on conflict do update
      await this.trx
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
            keycloakId: data.keycloakId,
            isActive: data.isActive,
            updatedAt: data.updatedAt,
          },
        });

      logger.info('User saved successfully:', {
        userId: data.userId,
        username: data.username,
      });
    } catch (error) {
      logger.error('Failed to save user:', {
        userId: user.id,
        error: error instanceof Error ? error.message : 'Unknown error',
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

      const row = await this.trx
        .select({ count: authUser.userId })
        .from(authUser)
        .where(and(...conditions))
        .limit(1);

      return row.length > 0;
    } catch (error) {
      logger.error('Failed to check if email is taken:', {
        email: email.toString(),
        error: error instanceof Error ? error.message : 'Unknown error',
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

      const row = await this.trx
        .select({ count: authUser.userId })
        .from(authUser)
        .where(and(...conditions))
        .limit(1);

      return row.length > 0;
    } catch (error) {
      logger.error('Failed to check if username is taken:', {
        username,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }
}
