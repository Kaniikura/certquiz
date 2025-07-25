/**
 * Test seed data helpers
 *
 * Provides utility functions for seeding test data in integration tests.
 * All seed functions return the inserted data for use in test assertions.
 */

import { type NewTestUser, testUsers } from './schema';
import type { TestDb } from './types';

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
) {
  const users = Array.from({ length: count }, () => _createFakeUser(overrides));

  const inserted = await db.insert(testUsers).values(users).returning();

  return inserted;
}

/**
 * Seed a single admin user
 */
export async function seedAdminUser<DB extends TestDb>(db: DB, overrides?: Partial<NewTestUser>) {
  const [admin] = await seedUsers(db, 1, {
    name: 'Admin User',
    email: 'admin@example.com',
    ...overrides,
  });

  return admin;
}

/**
 * Clear all users from the test database
 */
export async function clearUsers<DB extends TestDb>(db: DB) {
  await db.delete(testUsers);
}

// TODO: Add more seed functions as schema is implemented
// export function createFakeQuiz() { ... }
// export async function seedQuizzes() { ... }
// export async function seedQuestions() { ... }
// export async function seedSessions() { ... }
