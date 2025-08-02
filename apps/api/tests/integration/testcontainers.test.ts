import {
  createTestDatabase,
  createTestDb,
  seedAdminUser,
  seedUsers,
  type TestDb,
} from '@test/helpers/database';
import { testUsers } from '@test/helpers/db-schema';
import postgres from 'postgres';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { PostgresSingleton } from '../containers/postgres';

/**
 * Ensure test tables exist in the database
 */
async function ensureTestTables(client: postgres.Sql): Promise<void> {
  await client`
    CREATE TABLE IF NOT EXISTS test_users (
      id text PRIMARY KEY,
      email text NOT NULL UNIQUE,
      name text,
      is_active boolean DEFAULT true,
      created_at timestamp DEFAULT now()
    )
  `;
}

// Helper functions for clean resource management
async function usingMainDb<T>(fn: (db: TestDb) => Promise<T>): Promise<T> {
  const url = await PostgresSingleton.getConnectionUrl();
  const client = postgres(url, { max: 5 });
  const db = createTestDb(client);
  try {
    await ensureTestTables(client);
    return await fn(db);
  } finally {
    await client.end();
  }
}

async function usingIsoDb<T>(fn: (db: TestDb) => Promise<T>): Promise<T> {
  const container = await PostgresSingleton.getInstance();
  const { url, drop } = await createTestDatabase({ root: container });
  const client = postgres(url, { max: 5 });
  const db = createTestDb(client);
  try {
    await ensureTestTables(client);
    return await fn(db);
  } finally {
    await client.end();
    await drop(); // Clean up isolated database
  }
}

describe('Testcontainers Infrastructure', () => {
  let dbUrl: string;
  let cleanup: () => Promise<void>;
  let db: TestDb;
  let client: postgres.Sql;

  beforeAll(async () => {
    // Create fresh test database with migrations
    const container = await PostgresSingleton.getInstance();
    const fresh = await createTestDatabase({ root: container });
    dbUrl = fresh.url;
    cleanup = fresh.drop;

    // Create Drizzle client for testing
    client = postgres(dbUrl, { max: 10 });
    db = createTestDb(client);
    expect(db).toBeDefined();

    // Create test-specific tables that aren't part of production migrations
    await ensureTestTables(client);

    // Verify expected tables exist (fail fast on schema drift)
    const result = await client`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = 'test_users'
    `;
    expect(result).toHaveLength(1);
  });

  afterAll(async () => {
    if (client) {
      await client.end({ timeout: 5 });
    }
    if (cleanup) {
      await cleanup();
    }
  });

  afterEach(async () => {
    if (!client) return;

    // Verify no active transactions are left open
    const result = await client`SELECT count(*) as count 
        FROM pg_stat_activity 
        WHERE state <> 'idle' 
        AND datname = current_database()
        AND pid <> pg_backend_pid()`;
    const activeConnections = Number(result[0]?.count) || 0;
    expect(activeConnections).toBe(0);
  });

  it('should connect to PostgreSQL container', async () => {
    if (!client) {
      throw new Error('Client not initialized - check beforeAll setup');
    }

    // Test database connection by running a simple query
    const result = await client`SELECT 1 as test`;
    expect(result[0].test).toBe(1);
  });

  it('should get connection URL', async () => {
    const url = await PostgresSingleton.getConnectionUrl();
    expect(url).toMatch(
      /^postgres(?:ql)?:\/\/postgres:password@(?:localhost|[\d.]+):\d+\/certquiz_test$/
    );

    // Verify our test database URL is different (has random name)
    expect(dbUrl).toMatch(/^postgres(?:ql)?:\/\/postgres:password@(?:localhost|[\d.]+):\d+\/t_/);
  });

  describe('Transaction Isolation', () => {
    it('should rollback changes after test', async () => {
      // Count users before test
      const beforeCount = await db.select().from(testUsers);

      // Run test in transaction that will be rolled back
      try {
        await db.transaction(async (tx) => {
          const users = await seedUsers(tx, 3);
          expect(users).toHaveLength(3);

          const count = await tx.select().from(testUsers);
          expect(count).toHaveLength(beforeCount.length + 3);

          // Force rollback by throwing an error
          throw new Error('ROLLBACK_TEST');
        });
      } catch (error) {
        // Ignore the intentional rollback error
        if (error instanceof Error && error.message !== 'ROLLBACK_TEST') {
          throw error;
        }
      }

      // Verify rollback - count should be same as before
      const afterCount = await db.select().from(testUsers);
      expect(afterCount).toHaveLength(beforeCount.length);
    });

    it('should handle errors in transaction', async () => {
      await expect(
        db.transaction(async () => {
          throw new Error('Test error');
        })
      ).rejects.toThrow('Test error');
    });
  });

  describe('Seed Helpers', () => {
    it('should create test users', async () => {
      try {
        await db.transaction(async (tx) => {
          const users = await seedUsers(tx, 5);

          expect(users).toHaveLength(5);
          users.forEach((user: (typeof users)[0]) => {
            expect(user.id).toBeDefined();
            expect(user.email).toMatch(/^test-.*@example\.com$/);
            expect(user.isActive).toBe(true);
          });

          // Verify emails are unique
          const emails = users.map((u: (typeof users)[0]) => u.email);
          const uniqueEmails = new Set(emails);
          expect(uniqueEmails.size).toBe(emails.length);

          // Force rollback to avoid persisting test data
          throw new Error('ROLLBACK_TEST');
        });
      } catch (error) {
        // Ignore the intentional rollback error
        if (error instanceof Error && error.message !== 'ROLLBACK_TEST') {
          throw error;
        }
      }
    });

    it('should create admin user', async () => {
      try {
        await db.transaction(async (tx) => {
          const admin = await seedAdminUser(tx);

          expect(admin.name).toBe('Admin User');
          expect(admin.email).toBe('admin@example.com');

          // Force rollback to avoid persisting test data
          throw new Error('ROLLBACK_TEST');
        });
      } catch (error) {
        // Ignore the intentional rollback error
        if (error instanceof Error && error.message !== 'ROLLBACK_TEST') {
          throw error;
        }
      }
    });
  });

  describe('Database Reset (PostgresSingleton.resetToCleanState)', () => {
    it('should clear the main database', async () => {
      // Add data to main database
      await usingMainDb(async (db) => {
        await seedUsers(db, 2);
      });

      // Reset main database
      await PostgresSingleton.resetToCleanState();

      // Verify main database is empty after reset
      await usingMainDb(async (db) => {
        const users = await db.select().from(testUsers);
        expect(users).toHaveLength(0);
      });
    });

    it('should NOT affect isolated databases', async () => {
      // Test that reset only affects main DB, not isolated ones
      await usingIsoDb(async (isoDb) => {
        // Add data to isolated database
        await seedUsers(isoDb, 2);

        // Reset main database (should not affect isolated)
        await PostgresSingleton.resetToCleanState();

        // Verify isolated database is untouched
        const users = await isoDb.select().from(testUsers);
        expect(users).toHaveLength(2);
      });
    });
  });
});
