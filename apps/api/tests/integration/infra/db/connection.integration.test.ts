import {
  _resetIsolationState,
  cleanupWorkerDatabases,
  getTestDb,
} from '@api/testing/infra/db/connection';
import postgres from 'postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { getPostgres } from '../../../containers/postgres';

// Helper to temporarily override env in a test
async function withEnv(vars: Record<string, string>, fn: () => unknown) {
  // Store original values of variables we're going to change
  const originalValues: Record<string, string | undefined> = {};
  const keysToRestore = Object.keys(vars);

  // Save original values
  for (const key of keysToRestore) {
    originalValues[key] = process.env[key];
  }

  // Apply new values
  Object.assign(process.env, vars);

  try {
    return await fn();
  } finally {
    // Restore original values properly
    for (const key of keysToRestore) {
      if (originalValues[key] === undefined) {
        // Variable didn't exist before, so delete it
        delete process.env[key];
      } else {
        // Restore original value
        process.env[key] = originalValues[key];
      }
    }
  }
}

describe('Worker Database Isolation - Integration Tests', () => {
  let adminClient: postgres.Sql;
  let container: Awaited<ReturnType<typeof getPostgres>>;

  beforeAll(async () => {
    // Get the postgres container
    container = await getPostgres();
    const baseUri = container.getConnectionUri();
    const baseUrl = new URL(baseUri);

    // Create admin client for verification queries
    adminClient = postgres({
      host: baseUrl.hostname,
      port: parseInt(baseUrl.port, 10),
      user: 'postgres',
      password: 'password',
      database: 'postgres',
    });
  });

  afterAll(async () => {
    // Clean up all worker databases
    await cleanupWorkerDatabases();

    // Close admin client
    await adminClient.end();
  });

  it('should properly restore environment variables after withEnv', async () => {
    // Test variable that doesn't exist
    const testKey1 = 'TEST_NONEXISTENT_VAR';
    expect(process.env[testKey1]).toBeUndefined();

    // Test variable that exists
    const testKey2 = 'VITEST_WORKER_ID';
    const originalValue = process.env[testKey2];

    await withEnv(
      {
        [testKey1]: 'temporary_value',
        [testKey2]: 'modified_value',
      },
      async () => {
        // Inside withEnv, variables should be set
        expect(process.env[testKey1]).toBe('temporary_value');
        expect(process.env[testKey2]).toBe('modified_value');
      }
    );

    // After withEnv, variables should be restored
    expect(process.env[testKey1]).toBeUndefined(); // Should be deleted
    expect(process.env[testKey2]).toBe(originalValue); // Should be restored
  });

  it('should create unique databases for different workers', async () => {
    // Reset state before test
    _resetIsolationState();

    // Create database for worker 1
    await withEnv({ VITEST_WORKER_ID: 'integration1' }, async () => {
      const db1 = await getTestDb();
      expect(db1).toBeDefined();

      // Verify database exists
      const result = await adminClient`
        SELECT datname FROM pg_database 
        WHERE datname = 'certquiz_test_worker_integration1'
      `;
      expect(result).toHaveLength(1);
    });

    // Create database for worker 2
    await withEnv({ VITEST_WORKER_ID: 'integration2' }, async () => {
      const db2 = await getTestDb();
      expect(db2).toBeDefined();

      // Verify second database exists
      const result = await adminClient`
        SELECT datname FROM pg_database 
        WHERE datname = 'certquiz_test_worker_integration2'
      `;
      expect(result).toHaveLength(1);
    });

    // Verify both databases exist
    const allDbs = await adminClient`
      SELECT datname FROM pg_database 
      WHERE datname IN ('certquiz_test_worker_integration1', 'certquiz_test_worker_integration2')
      ORDER BY datname
    `;
    expect(allDbs).toHaveLength(2);
    expect(allDbs[0].datname).toBe('certquiz_test_worker_integration1');
    expect(allDbs[1].datname).toBe('certquiz_test_worker_integration2');
  });

  it('should return the same instance for concurrent calls within same worker', async () => {
    // Reset state before test
    _resetIsolationState();

    await withEnv({ VITEST_WORKER_ID: 'concurrenttest' }, async () => {
      // Start multiple concurrent requests
      const promises = Array(5)
        .fill(null)
        .map(() => getTestDb());

      // All should resolve to the same instance
      const dbs = await Promise.all(promises);

      // Verify all are the same instance
      const firstDb = dbs[0];
      dbs.forEach((db, _index) => {
        expect(db).toBe(firstDb);
      });

      // Verify only one database was created
      const result = await adminClient`
        SELECT COUNT(*) as count FROM pg_database 
        WHERE datname = 'certquiz_test_worker_concurrenttest'
      `;
      expect(parseInt(result[0].count)).toBe(1);
    });
  });

  it('should apply migrations to worker databases', async () => {
    // Reset state before test
    _resetIsolationState();

    await withEnv({ VITEST_WORKER_ID: 'migrationtest' }, async () => {
      await getTestDb();

      // Connect to the worker database to check migrations
      const baseUri = container.getConnectionUri();
      const workerUrl = new URL(baseUri);
      workerUrl.pathname = '/certquiz_test_worker_migrationtest';
      const workerClient = postgres(workerUrl.toString());

      try {
        // Check that migrations were applied (drizzle migrations table exists)
        const migrations = await workerClient`
          SELECT table_name FROM information_schema.tables 
          WHERE table_schema = 'drizzle' 
          AND table_name = '__drizzle_migrations'
        `;
        expect(migrations).toHaveLength(1);

        // Check that test_users table exists (from test migrations)
        const testTables = await workerClient`
          SELECT table_name FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'test_users'
        `;
        expect(testTables).toHaveLength(1);
      } finally {
        await workerClient.end();
      }
    });
  });

  it('should clean up worker databases properly', async () => {
    // Reset state and create some test databases
    _resetIsolationState();

    // Clean up any leftover databases from previous runs first
    const existingDbs = await adminClient`
      SELECT datname FROM pg_database 
      WHERE datname LIKE 'certquiz_test_worker_cleanup%'
    `;

    // Drop any existing cleanup test databases
    for (const db of existingDbs) {
      await adminClient.unsafe(`DROP DATABASE IF EXISTS ${db.datname}`);
    }

    // Create databases for cleanup test
    await withEnv({ VITEST_WORKER_ID: 'cleanup1' }, async () => {
      await getTestDb();
    });

    await withEnv({ VITEST_WORKER_ID: 'cleanup2' }, async () => {
      await getTestDb();
    });

    // Verify databases exist
    const beforeCleanup = await adminClient`
      SELECT datname FROM pg_database 
      WHERE datname LIKE 'certquiz_test_worker_cleanup%'
    `;
    expect(beforeCleanup).toHaveLength(2);

    // Clean up
    await cleanupWorkerDatabases();

    // Verify databases are gone
    const afterCleanup = await adminClient`
      SELECT datname FROM pg_database 
      WHERE datname LIKE 'certquiz_test_worker_cleanup%'
    `;
    expect(afterCleanup).toHaveLength(0);
  });
});
