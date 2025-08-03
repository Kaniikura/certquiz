/**
 * Database seed utilities for tests
 */

import type { TestDb } from './db-connection';
import type { NewTestUser, TestUser } from './db-schema';
import { testUsers } from './db-schema';

/**
 * Create a fake user for testing.
 * Generates deterministic test data that can be overridden.
 */
function _createFakeUser(overrides?: Partial<NewTestUser>): NewTestUser {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(7);

  // Base user with sensible defaults
  const baseUser: NewTestUser = {
    name: `Test User ${random}`,
    email: `test-${timestamp}-${random}@example.com`,
    isActive: true,
  };

  // Apply overrides last to ensure they take precedence
  return {
    ...baseUser,
    ...overrides,
  };
}

/**
 * Seed users into the test database
 */
export async function seedUsers<DB extends TestDb>(
  db: DB,
  count = 3,
  overrides?: Partial<NewTestUser>
): Promise<TestUser[]> {
  const users = Array.from({ length: count }, () => _createFakeUser(overrides));

  const inserted = await db.insert(testUsers).values(users).returning();

  return inserted;
}

/**
 * Seed a single admin user
 */
export async function seedAdminUser<DB extends TestDb>(
  db: DB,
  overrides?: Partial<NewTestUser>
): Promise<TestUser> {
  const [admin] = await seedUsers(db, 1, {
    name: 'Admin User',
    email: 'admin@example.com',
    ...overrides,
  });

  return admin;
}
