import type { User } from '../entities/User';
import type { Email } from '../value-objects/Email';
import type { UserId } from '../value-objects/UserId';
import type { IUserRepository } from './IUserRepository';

// TODO: Import Drizzle types when database schema is ready
// import { eq, and, ne } from 'drizzle-orm';
// import { PostgresJsTransaction } from 'drizzle-orm/postgres-js';
// import { authUser } from '@api/infra/db/schema';

/**
 * Drizzle implementation of User repository
 * Uses transaction for consistency with other repositories
 */
export class DrizzleUserRepository implements IUserRepository {
  async findById(_id: UserId): Promise<User | null> {
    // TODO: Implement with Drizzle query
    // Example pattern for handling Result from fromPersistence:
    // const row = await this.trx.query.users.findFirst({
    //   where: eq(users.userId, UserId.toString(id))
    // });
    // if (!row) return null;
    // const result = User.fromPersistence(row);
    // if (!result.success) {
    //   // Log error and return null or throw based on requirements
    //   console.error('Invalid user data in database:', result.error);
    //   return null;
    // }
    // return result.data;
    throw new Error('Not implemented - requires database schema integration');
  }

  async findByEmail(_email: Email): Promise<User | null> {
    // TODO: Implement with Drizzle query
    throw new Error('Not implemented - requires database schema integration');
  }

  async findByKeycloakId(_keycloakId: string): Promise<User | null> {
    // TODO: Implement with Drizzle query
    throw new Error('Not implemented - requires database schema integration');
  }

  async findByUsername(_username: string): Promise<User | null> {
    // TODO: Implement with Drizzle query
    throw new Error('Not implemented - requires database schema integration');
  }

  async save(_user: User): Promise<void> {
    // TODO: Implement with Drizzle transaction
    throw new Error('Not implemented - requires database schema integration');
  }

  async isEmailTaken(_email: Email, _excludeUserId?: UserId): Promise<boolean> {
    // TODO: Implement with Drizzle query
    throw new Error('Not implemented - requires database schema integration');
  }

  async isUsernameTaken(_username: string, _excludeUserId?: UserId): Promise<boolean> {
    // TODO: Implement with Drizzle query
    throw new Error('Not implemented - requires database schema integration');
  }
}
