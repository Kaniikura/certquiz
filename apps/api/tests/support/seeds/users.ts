import type { ExtractTablesWithRelations } from 'drizzle-orm';
import type { PostgresJsDatabase, PostgresJsTransaction } from 'drizzle-orm/postgres-js';
import { type NewTestUser, type testSchema, testUsers } from '../test-schema';

// TODO: Replace with actual schema when implemented
type Schema = typeof testSchema;
type Relations = ExtractTablesWithRelations<Schema>;
type TestDb = PostgresJsDatabase<Schema> | PostgresJsTransaction<Schema, Relations>;

/**
 * Create a fake user for testing.
 * Generates deterministic test data that can be overridden.
 */
export function createFakeUser(overrides?: Partial<NewTestUser>): NewTestUser {
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
export async function seedUsers(db: TestDb, count = 3, overrides?: Partial<NewTestUser>) {
  const users = Array.from({ length: count }, () => createFakeUser(overrides));

  const inserted = await db.insert(testUsers).values(users).returning();

  return inserted;
}

/**
 * Seed a single admin user
 */
export async function seedAdminUser(db: TestDb, overrides?: Partial<NewTestUser>) {
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
export async function clearUsers(db: TestDb) {
  await db.delete(testUsers);
}
