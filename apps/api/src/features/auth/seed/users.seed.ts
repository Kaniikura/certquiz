/**
 * User seed data
 * @fileoverview Seed data for auth users
 */

import * as crypto from 'node:crypto';
import type { DB } from '@api/infra/db/client';
import { authUser } from '@api/infra/db/schema';
import type { LoggerPort } from '@api/shared/logger';
import { Result } from '@api/shared/result';
import { eq } from 'drizzle-orm';

import { DrizzleUserRepository } from '../domain/repositories/DrizzleUserRepository';
import { Email } from '../domain/value-objects/Email';
import { UserRole } from '../domain/value-objects/UserRole';

/**
 * User seed data structure
 */
export interface UserSeedData {
  id: string;
  email: string;
  username: string;
  role: UserRole;
  identityProviderId?: string;
  isActive?: boolean;
}

/**
 * Generate deterministic UUID v5 from namespace and name
 */
const SEED_NAMESPACE = '6ba7b810-9dad-11d1-80b4-00c04fd430c8'; // Well-known namespace UUID

export function seedUuid(name: string): string {
  const hash = crypto.createHash('sha1');
  hash.update(SEED_NAMESPACE.replace(/-/g, ''), 'hex');
  hash.update(name, 'utf8');
  const hashBytes = hash.digest();

  // Format as UUID v5
  const hex = hashBytes.toString('hex');
  return [
    hex.substring(0, 8),
    hex.substring(8, 12),
    `5${hex.substring(13, 16)}`, // Version 5
    ((parseInt(hex.substring(16, 18), 16) & 0x3f) | 0x80).toString(16) + hex.substring(18, 20), // Variant
    hex.substring(20, 32),
  ].join('-');
}

/**
 * Default test users
 * These are deterministic users for development and demo purposes
 */
export const userSeeds: UserSeedData[] = [
  {
    id: seedUuid('seed-admin-001'),
    email: 'admin@certquiz.test',
    username: 'admin',
    role: UserRole.Admin,
    identityProviderId: 'seed-idp-admin-001',
    isActive: true,
  },
  {
    id: seedUuid('seed-premium-001'),
    email: 'premium1@certquiz.test',
    username: 'premium1',
    role: UserRole.Premium,
    identityProviderId: 'seed-idp-premium-001',
    isActive: true,
  },
  {
    id: seedUuid('seed-premium-002'),
    email: 'premium2@certquiz.test',
    username: 'premium2',
    role: UserRole.Premium,
    identityProviderId: 'seed-idp-premium-002',
    isActive: true,
  },
  {
    id: seedUuid('seed-user-001'),
    email: 'user1@certquiz.test',
    username: 'user1',
    role: UserRole.User,
    identityProviderId: 'seed-idp-user-001',
    isActive: true,
  },
  {
    id: seedUuid('seed-user-002'),
    email: 'user2@certquiz.test',
    username: 'user2',
    role: UserRole.User,
    identityProviderId: 'seed-idp-user-002',
    isActive: true,
  },
  {
    id: seedUuid('seed-user-003'),
    email: 'inactive@certquiz.test',
    username: 'inactive',
    role: UserRole.User,
    identityProviderId: 'seed-idp-user-003',
    isActive: false, // Inactive user for testing
  },
  {
    id: seedUuid('seed-guest-001'),
    email: 'guest@certquiz.test',
    username: 'guest',
    role: UserRole.Guest,
    // No identityProviderId for guest
    isActive: true,
  },
];

/**
 * Create users from seed data
 */
export async function up(db: DB, logger: LoggerPort): Promise<Result<void, Error>> {
  const repository = new DrizzleUserRepository(db, logger);

  try {
    logger.info(`Seeding ${userSeeds.length} users`);

    for (const userData of userSeeds) {
      logger.debug(`Creating user: ${userData.username} (${userData.email})`);

      // Check if user already exists
      const emailResult = Email.create(userData.email);
      if (!emailResult.success) {
        logger.error(`Invalid email format: ${userData.email}`);
        continue;
      }

      const existingByEmail = await repository.findByEmail(emailResult.data);
      if (existingByEmail) {
        logger.debug(`User ${userData.email} already exists, skipping`);
        continue;
      }

      // Create user record directly since we don't have password management
      // In a real scenario, these would be created via KeyCloak
      const userRecord = {
        userId: userData.id,
        email: userData.email,
        username: userData.username,
        identityProviderId: userData.identityProviderId ?? null,
        role: userData.role,
        isActive: userData.isActive ?? true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await db.insert(authUser).values(userRecord).onConflictDoNothing();

      logger.debug(`Created user: ${userData.username}`);
    }

    logger.info('User seeding completed');
    return Result.ok(undefined);
  } catch (error) {
    logger.error('Failed to seed users', {
      error: error instanceof Error ? error.message : String(error),
    });
    return Result.err(new Error(`User seeding failed: ${error}`));
  }
}

/**
 * Remove seeded users
 * Only removes users with seed- prefix IDs to avoid deleting real data
 */
export async function down(db: DB, logger: LoggerPort): Promise<Result<void, Error>> {
  try {
    logger.info('Removing seeded users');

    // Only delete users with seed IDs
    const seedUserIds = userSeeds.map((u) => u.id);

    for (const userId of seedUserIds) {
      await db.delete(authUser).where(eq(authUser.userId, userId));
      logger.debug(`Removed user: ${userId}`);
    }

    logger.info('User seed cleanup completed');
    return Result.ok(undefined);
  } catch (error) {
    logger.error('Failed to remove seeded users', {
      error: error instanceof Error ? error.message : String(error),
    });
    return Result.err(new Error(`User seed cleanup failed: ${error}`));
  }
}

/**
 * Get a specific seeded user by role (helper for other seeds)
 */
export function getSeededUserByRole(role: UserRole): UserSeedData | undefined {
  return userSeeds.find((u) => u.role === role && u.isActive);
}

/**
 * Get all active seeded users (helper for other seeds)
 */
export function getActiveSeededUsers(): UserSeedData[] {
  return userSeeds.filter((u) => u.isActive);
}
