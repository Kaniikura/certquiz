import { sql } from 'drizzle-orm';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { PostgresSingleton } from '../containers/postgres';
import {
  checkTestDbHealth,
  closeTestDb,
  getTestDb,
  seeds,
  testUsers,
  withRollback,
} from '../support';

describe('Testcontainers Infrastructure', () => {
  beforeAll(async () => {
    // Container will be started automatically by getTestDb
    const db = await getTestDb();
    expect(db).toBeDefined();
  });

  afterAll(async () => {
    await closeTestDb();
  });

  afterEach(async () => {
    // Verify no active transactions are left open
    const db = await getTestDb();
    const result = await db.execute(
      sql`SELECT count(*) as count 
          FROM pg_stat_activity 
          WHERE state <> 'idle' 
          AND datname = 'certquiz_test'
          AND pid <> pg_backend_pid()`
    );
    const activeConnections = Number(result[0]?.count) || 0;
    expect(activeConnections).toBe(0);
  });

  it('should connect to PostgreSQL container', async () => {
    const healthy = await checkTestDbHealth();
    expect(healthy).toBe(true);
  });

  it('should get connection URL', async () => {
    const url = await PostgresSingleton.getConnectionUrl();
    expect(url).toMatch(/^postgres(?:ql)?:\/\/postgres:password@localhost:\d+\/certquiz_test$/);
  });

  describe('Transaction Isolation', () => {
    it('should rollback changes after test', async () => {
      const db = await getTestDb();

      // Count users before test
      const beforeCount = await db.select().from(testUsers);

      // Run test in transaction that will be rolled back
      await withRollback(async (db) => {
        const users = await seeds.seedUsers(db, 3);
        expect(users).toHaveLength(3);

        const count = await db.select().from(testUsers);
        expect(count).toHaveLength(beforeCount.length + 3);
      });

      // Verify rollback - count should be same as before
      const afterCount = await db.select().from(testUsers);
      expect(afterCount).toHaveLength(beforeCount.length);
    });

    it('should handle errors in transaction', async () => {
      await expect(
        withRollback(async () => {
          throw new Error('Test error');
        })
      ).rejects.toThrow('Test error');
    });
  });

  describe('Seed Helpers', () => {
    it('should create test users', async () => {
      await withRollback(async (db) => {
        const users = await seeds.seedUsers(db, 5);

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
      });
    });

    it('should create admin user', async () => {
      await withRollback(async (db) => {
        const admin = await seeds.seedAdminUser(db);

        expect(admin.name).toBe('Admin User');
        expect(admin.email).toBe('admin@example.com');
      });
    });
  });

  describe('Database Reset', () => {
    it('should reset database to clean state', async () => {
      let db = await getTestDb();

      // Verify database starts empty (for clarity)
      const initialUsers = await db.select().from(testUsers);
      expect(initialUsers).toHaveLength(0);

      // Add some data
      await seeds.seedUsers(db, 2);

      // Verify data was added
      const usersBeforeReset = await db.select().from(testUsers);
      expect(usersBeforeReset).toHaveLength(2);

      // Close existing connections before reset
      await closeTestDb();

      // Reset database
      await PostgresSingleton.resetToCleanState();

      // Get a new connection after reset
      db = await getTestDb();

      // Verify database is empty
      const users = await db.select().from(testUsers);
      expect(users).toHaveLength(0);
    });
  });
});
