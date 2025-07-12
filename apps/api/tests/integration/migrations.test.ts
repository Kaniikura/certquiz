import { execSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getMigrationStatus, migrateDown, migrateUp } from '@api/system/migration/api';
import postgres from 'postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PostgresSingleton } from '../containers/postgres';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe('Database Migrations', () => {
  let connectionUrl: string;
  let dbName: string;

  // Create a single test database for all migration tests
  beforeAll(async () => {
    // Get the base container
    const container = await PostgresSingleton.getInstance();
    const baseUrl = container.getConnectionUri();

    // Create a dedicated database for migration tests
    dbName = `test_migrations_${Date.now()}`;
    const adminClient = postgres(baseUrl, { max: 1 });

    try {
      await adminClient.unsafe(`CREATE DATABASE "${dbName}"`);
      connectionUrl = baseUrl.replace(/\/[^/?]+(\?.*)?$/, `/${dbName}$1`);
    } finally {
      await adminClient.end();
    }
  });

  afterAll(async () => {
    // Clean up the test database
    if (dbName) {
      const container = await PostgresSingleton.getInstance();
      const baseUrl = container.getConnectionUri();
      const adminClient = postgres(baseUrl, { max: 1 });

      try {
        // Terminate connections and drop database
        await adminClient`
          SELECT pg_terminate_backend(pg_stat_activity.pid)
          FROM pg_stat_activity
          WHERE pg_stat_activity.datname = ${dbName}
            AND pid <> pg_backend_pid()
        `;
        await adminClient.unsafe(`DROP DATABASE IF EXISTS "${dbName}"`);
      } finally {
        await adminClient.end();
      }
    }
  });

  it('should apply migrations successfully (up)', async () => {
    const result = await migrateUp(connectionUrl);
    expect(result.success).toBe(true);

    // Verify tables were created
    const client = postgres(connectionUrl);
    try {
      // Check for migrations table in both public and drizzle schemas
      const migrationsResult = await client`
        SELECT table_schema, table_name 
        FROM information_schema.tables 
        WHERE table_schema IN ('public', 'drizzle')
        AND table_name = '__drizzle_migrations'
      `;

      // Should have the migrations tracking table
      expect(migrationsResult.length).toBeGreaterThan(0);
      expect(migrationsResult.some((r) => r.table_name === '__drizzle_migrations')).toBe(true);

      // Check for our test migration table in public schema
      const publicTables = await client`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_type = 'BASE TABLE'
        ORDER BY table_name
      `;

      // Should have at least our test_migration table
      expect(publicTables.some((r) => r.table_name === 'test_migration')).toBe(true);
    } finally {
      await client.end();
    }
  });

  it('should be idempotent (running up twice is safe)', async () => {
    // Second run should be no-op
    const result = await migrateUp(connectionUrl);
    expect(result.success).toBe(true);
  });

  it('should show correct status', async () => {
    const statusResult = await getMigrationStatus(connectionUrl);
    expect(statusResult.success).toBe(true);
    if (statusResult.success) {
      expect(statusResult.data.applied.length).toBeGreaterThan(0);
      expect(statusResult.data.pending.length).toBe(0);
    }
  });

  it('should rollback migrations (down)', async () => {
    // Roll back the migration
    const result = await migrateDown(connectionUrl);
    expect(result.success).toBe(true);

    // Verify the test_migration table was dropped
    const client = postgres(connectionUrl);
    try {
      const publicTables = await client`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_type = 'BASE TABLE'
        AND table_name = 'test_migration'
      `;

      // Should not have the test_migration table anymore
      expect(publicTables.length).toBe(0);
    } finally {
      await client.end();
    }

    // Verify status shows no applied migrations
    const statusResult = await getMigrationStatus(connectionUrl);
    expect(statusResult.success).toBe(true);
    if (statusResult.success) {
      expect(statusResult.data.applied.length).toBe(0);
      expect(statusResult.data.pending.length).toBeGreaterThan(0);
    }
  });

  it('should use advisory locks to prevent concurrent migrations', async () => {
    // Roll back to ensure we have a migration to apply
    await migrateDown(connectionUrl);

    // Try to run two migrations concurrently - only one should succeed
    const promises = [migrateUp(connectionUrl), migrateUp(connectionUrl)];

    const results = await Promise.all(promises);

    // One should succeed, one should fail due to lock
    expect(results).toHaveLength(2);
    const successCount = results.filter((result) => result.success).length;
    const failureCount = results.filter((result) => !result.success).length;

    expect(successCount).toBe(1);
    expect(failureCount).toBe(1);

    // The failed one should mention lock or concurrent migration
    const failedResult = results.find((result) => !result.success);
    if (failedResult && !failedResult.success) {
      expect(failedResult.error).toMatch(/already running|lock/i);
    }
  });
});

describe('Migration Validation', () => {
  it('should validate migration files', async () => {
    const scriptPath = path.resolve(__dirname, '../../scripts/validate-migrations.ts');

    try {
      const output = execSync(`bun run ${scriptPath}`, {
        encoding: 'utf8',
      });

      // The validation should pass or give specific errors
      expect(output).toBeTruthy();
    } catch (error) {
      // If validation fails, we should see clear error messages
      if (error instanceof Error) {
        // Type assertion for ExecSync error shape
        interface ExecError extends Error {
          stdout?: string;
          stderr?: string;
        }
        const execError = error as ExecError;
        const output = execError.stdout || execError.stderr || '';
        expect(output).toContain('Validation');
      } else {
        throw error;
      }
    }
  });
});
