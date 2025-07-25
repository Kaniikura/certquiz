/**
 * User seed data
 * @fileoverview Seed data for auth users
 */

import * as crypto from 'node:crypto';
import { authUser } from '@api/infra/db/schema';
import type { DB } from '@api/infra/db/types';
import type { LoggerPort } from '@api/shared/logger';
import { Result } from '@api/shared/result';
import { inArray } from 'drizzle-orm';

import { Email } from '../domain/value-objects/Email';
import { UserRole } from '../domain/value-objects/UserRole';

/**
 * User seed data structure
 */
interface UserSeedData {
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
const userSeeds: UserSeedData[] = [
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
  try {
    logger.info(`Seeding ${userSeeds.length} users`);

    // Validate all emails first
    const validatedSeeds = [];
    for (const userData of userSeeds) {
      const emailResult = Email.create(userData.email);
      if (!emailResult.success) {
        logger.error(`Invalid email format: ${userData.email}`);
        continue;
      }
      validatedSeeds.push(userData);
    }

    if (validatedSeeds.length === 0) {
      logger.info('No valid users to seed');
      return Result.ok(undefined);
    }

    // Batch check for existing users
    const emails = validatedSeeds.map((u) => u.email);
    const existingUsers = await db.query.authUser.findMany({
      where: inArray(authUser.email, emails),
      columns: { email: true },
    });

    const existingEmails = new Set(existingUsers.map((u) => u.email));

    // Filter out users that already exist
    const newUserSeeds = validatedSeeds.filter((userData) => !existingEmails.has(userData.email));

    if (newUserSeeds.length === 0) {
      logger.info('All users already exist, skipping');
      return Result.ok(undefined);
    }

    // Batch insert all new users
    const userRecords = newUserSeeds.map((userData) => ({
      userId: userData.id,
      email: userData.email,
      username: userData.username,
      identityProviderId: userData.identityProviderId ?? null,
      role: userData.role,
      isActive: userData.isActive ?? true,
      createdAt: new Date(),
      updatedAt: new Date(),
    }));

    // Use onConflictDoNothing to handle any race conditions
    await db.insert(authUser).values(userRecords).onConflictDoNothing();

    logger.info(`Created ${newUserSeeds.length} users`);
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

    if (seedUserIds.length === 0) {
      logger.info('No seeded users to remove');
      return Result.ok(undefined);
    }

    // Batch delete all seeded users
    const deleted = await db
      .delete(authUser)
      .where(inArray(authUser.userId, seedUserIds))
      .returning({ userId: authUser.userId });

    logger.info(`Removed ${deleted.length} users`);
    return Result.ok(undefined);
  } catch (error) {
    logger.error('Failed to remove seeded users', {
      error: error instanceof Error ? error.message : String(error),
    });
    return Result.err(new Error(`User seed cleanup failed: ${error}`));
  }
}

/**
 * Get all active seeded users (helper for other seeds)
 */
export function getActiveSeededUsers(): UserSeedData[] {
  return userSeeds.filter((u) => u.isActive);
}
