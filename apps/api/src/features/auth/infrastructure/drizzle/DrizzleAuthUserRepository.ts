import type { TransactionContext } from '@api/infra/unit-of-work';
import type { LoggerPort } from '@api/shared/logger/LoggerPort';
import { BaseRepository } from '@api/shared/repository/BaseRepository';
import { and, asc, desc, eq, gte, like, ne, or, type SQL, sql } from 'drizzle-orm';
import { User } from '../../domain/entities/User';
import type {
  IAuthUserRepository,
  PaginatedUserResult,
  UserPaginationParams,
} from '../../domain/repositories/IAuthUserRepository';
import type { Email } from '../../domain/value-objects/Email';
import { UserId } from '../../domain/value-objects/UserId';
import { authUser } from './schema/authUser';

// Type alias to match the role strings from UserRole enum
type UserRoleString = 'guest' | 'user' | 'premium' | 'admin';

/**
 * Drizzle implementation of User repository
 * Uses Queryable interface to work with both DB client and transactions
 */
export class DrizzleAuthUserRepository extends BaseRepository implements IAuthUserRepository {
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
          role: data.role as UserRoleString,
        })
        .onConflictDoUpdate({
          target: authUser.userId,
          set: {
            email: data.email,
            username: data.username,
            role: data.role as UserRoleString,
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

  async countTotalUsers(): Promise<number> {
    try {
      const result = await this.conn.select({ count: sql<number>`COUNT(*)` }).from(authUser);

      return Number(result[0]?.count ?? 0);
    } catch (error) {
      this.logger.error('Failed to count total users:', {
        error: this.getErrorDetails(error),
      });
      throw error;
    }
  }

  async countActiveUsers(since?: Date): Promise<number> {
    try {
      const conditions = [eq(authUser.isActive, true)];

      if (since) {
        conditions.push(gte(authUser.lastLoginAt, since));
      }

      const result = await this.conn
        .select({ count: sql<number>`COUNT(*)` })
        .from(authUser)
        .where(and(...conditions));

      return Number(result[0]?.count ?? 0);
    } catch (error) {
      this.logger.error('Failed to count active users:', {
        since,
        error: this.getErrorDetails(error),
      });
      throw error;
    }
  }

  async findAllPaginated(params: UserPaginationParams): Promise<PaginatedUserResult> {
    try {
      const { page = 1, pageSize = 20, filters, orderBy = 'createdAt', orderDir = 'desc' } = params;

      // Build filter conditions using extracted helper
      const conditions = this.buildFilterConditions(filters);

      // Count total records using extracted helper
      const total = await this.countUsersWithFilters(conditions);

      // Build order clause using extracted helper
      const orderClause = this.buildOrderClause(orderBy, orderDir);

      // Query users with filters using extracted helper
      const rows = await this.queryUsersWithFilters(conditions, orderClause, page, pageSize);

      // Convert rows to User entities using extracted helper
      const items = this.convertRowsToUsers(rows);

      return {
        items,
        total,
        page,
        pageSize,
      };
    } catch (error) {
      this.logger.error('Failed to find paginated users:', {
        params,
        error: this.getErrorDetails(error),
      });
      throw error;
    }
  }

  async updateLastLoginAt(userId: UserId): Promise<void> {
    try {
      await this.conn
        .update(authUser)
        .set({
          lastLoginAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(authUser.userId, UserId.toString(userId)));

      this.logger.info('User last login updated successfully', {
        userId: UserId.toString(userId),
      });
    } catch (error) {
      this.logger.error('Failed to update user last login:', {
        userId: UserId.toString(userId),
        error: this.getErrorDetails(error),
      });
      throw error;
    }
  }

  async updateRole(userId: UserId, role: string, updatedBy: string): Promise<void> {
    try {
      // Role validation is handled by Zod schema in handler layer
      // Repository focuses on persistence only

      await this.conn
        .update(authUser)
        .set({
          role: role as UserRoleString,
          updatedAt: new Date(),
        })
        .where(eq(authUser.userId, UserId.toString(userId)));

      this.logger.info('User role updated successfully', {
        userId: UserId.toString(userId),
        newRole: role,
        updatedBy,
      });
    } catch (error) {
      this.logger.error('Failed to update user role:', {
        userId: UserId.toString(userId),
        role,
        updatedBy,
        error: this.getErrorDetails(error),
      });
      throw error;
    }
  }

  /**
   * Build filter conditions for user pagination queries
   * @param filters Optional filters to apply
   * @returns Array of SQL conditions
   */
  private buildFilterConditions(filters?: UserPaginationParams['filters']) {
    const conditions: SQL[] = [];

    if (filters) {
      if (filters.search) {
        const searchPattern = `%${filters.search}%`;
        const searchCondition = or(
          like(authUser.email, searchPattern),
          like(authUser.username, searchPattern)
        );
        if (searchCondition) {
          conditions.push(searchCondition);
        }
      }

      if (filters.role !== undefined) {
        conditions.push(eq(authUser.role, filters.role as UserRoleString));
      }

      if (filters.isActive !== undefined) {
        conditions.push(eq(authUser.isActive, filters.isActive));
      }
    }

    return conditions;
  }

  /**
   * Build order clause for user pagination queries
   * @param orderBy Column to order by
   * @param orderDir Sort direction
   * @returns SQL order clause
   */
  private buildOrderClause(
    orderBy: UserPaginationParams['orderBy'] = 'createdAt',
    orderDir: UserPaginationParams['orderDir'] = 'desc'
  ) {
    const orderColumn =
      orderBy === 'email'
        ? authUser.email
        : orderBy === 'username'
          ? authUser.username
          : authUser.createdAt;

    return orderDir === 'desc' ? desc(orderColumn) : asc(orderColumn);
  }

  /**
   * Count total users matching the filter conditions
   * @param conditions Array of SQL conditions
   * @returns Total count of matching users
   */
  private async countUsersWithFilters(conditions: SQL[]): Promise<number> {
    const countResult = await this.conn
      .select({ count: sql<number>`COUNT(*)` })
      .from(authUser)
      .where(conditions.length > 0 ? and(...conditions) : undefined);

    return Number(countResult[0]?.count ?? 0);
  }

  /**
   * Query users with filters, ordering, and pagination
   * @param conditions Array of SQL conditions
   * @param orderClause SQL order clause
   * @param page Page number (1-based)
   * @param pageSize Number of items per page
   * @returns Array of raw database rows
   */
  private async queryUsersWithFilters(
    conditions: SQL[],
    orderClause: SQL,
    page: number,
    pageSize: number
  ) {
    const offset = (page - 1) * pageSize;

    return await this.conn
      .select()
      .from(authUser)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(orderClause)
      .limit(pageSize)
      .offset(offset);
  }

  /**
   * Convert raw database rows to User entities
   * @param rows Raw database rows
   * @returns Array of User entities (invalid rows are skipped with warning)
   */
  private convertRowsToUsers(rows: (typeof authUser.$inferSelect)[]): User[] {
    const items: User[] = [];

    for (const row of rows) {
      const result = User.fromPersistence(row);
      if (result.success) {
        items.push(result.data);
      } else {
        this.logger.warn('Skipping invalid user data in pagination', {
          userId: row.userId,
          error: result.error.message,
        });
      }
    }

    return items;
  }
}
