import { exec } from 'node:child_process';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';
import type { StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import postgres from 'postgres';

const execAsync = promisify(exec);

/**
 * Run Drizzle migrations against a test container
 */
export async function drizzleMigrate(container: StartedPostgreSqlContainer): Promise<void> {
  const connectionUri = container.getConnectionUri();

  // Check if migrations directory exists
  const migrationsDir = path.join(__dirname, '../../src/infra/db/migrations');
  let hasMigrations = false;

  try {
    const files = await fs.readdir(migrationsDir);
    hasMigrations = files.some((file) => file.endsWith('.sql'));
  } catch (_error) {
    // Directory doesn't exist or can't be read
    hasMigrations = false;
  }

  if (!hasMigrations) {
    // No production migrations yet, but create test tables
    await createTestTables(container);
    return;
  }

  try {
    // Set DATABASE_URL for drizzle-kit to use
    const env = {
      ...process.env,
      DATABASE_URL: connectionUri,
    };

    // Run migrations
    const { stderr } = await execAsync('bun run db:migrate', {
      cwd: path.join(__dirname, '../..'),
      env,
    });

    if (stderr && !stderr.includes('No migrations to run')) {
      console.log('ℹ️ No migrations to run - database is already up to date');
    }

    // Also create test-specific tables
    await createTestTables(container);
  } catch (error) {
    throw new Error(
      `Failed to run migrations: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Check if migrations are up to date
 */
export async function checkMigrations(container: StartedPostgreSqlContainer): Promise<boolean> {
  const connectionUri = container.getConnectionUri();

  try {
    const env = {
      ...process.env,
      DATABASE_URL: connectionUri,
    };

    const { stdout } = await execAsync('bun run drizzle-kit check', {
      cwd: path.join(__dirname, '../..'),
      env,
    });

    return stdout.includes('No migrations to run');
  } catch {
    return false;
  }
}

/**
 * Create test-specific tables that are not part of production schema
 */
async function createTestTables(container: StartedPostgreSqlContainer): Promise<void> {
  try {
    // Create test_users table for infrastructure testing
    await container.exec([
      'psql',
      '-U',
      'postgres',
      '-d',
      'certquiz_test',
      '-c',
      `CREATE TABLE IF NOT EXISTS test_users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        is_active BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`,
    ]);
  } catch (error) {
    throw new Error(
      `Failed to create test tables: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Resets migration state by dropping the drizzle schema
 * This is safer than dropping all tables
 *
 * @param connectionUrl - Database connection URL
 */
export async function resetMigrationState(connectionUrl: string): Promise<void> {
  const client = postgres(connectionUrl, { max: 1 });

  try {
    // Drop only the drizzle schema to reset migration state
    await client`DROP SCHEMA IF EXISTS "drizzle" CASCADE;`;

    // Also drop any test-specific tables
    await client`DROP TABLE IF EXISTS "test_migration" CASCADE;`;
  } catch {
    // Silently ignore - schema might not exist
  } finally {
    await client.end();
  }
}

/**
 * Verifies that expected tables exist after migration
 *
 * @param connectionUrl - Database connection URL
 * @param expectedTables - List of table names that should exist
 * @returns Object with verification results
 */
export async function verifyMigrationTables(
  connectionUrl: string,
  expectedTables: string[] = ['test_migration']
): Promise<{
  migrationsTable: boolean;
  expectedTables: Record<string, boolean>;
  allTablesExist: boolean;
}> {
  const client = postgres(connectionUrl, { max: 1 });

  try {
    // Check for migrations table
    const migrationsResult = await client`
      SELECT table_schema, table_name 
      FROM information_schema.tables 
      WHERE table_schema IN ('public', 'drizzle')
      AND table_name = '__drizzle_migrations'
    `;

    // Check for expected tables in public schema
    const publicTables = await client`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `;

    const publicTableNames = publicTables.map((row) => row.table_name);
    const expectedTableResults: Record<string, boolean> = {};

    for (const tableName of expectedTables) {
      expectedTableResults[tableName] = publicTableNames.includes(tableName);
    }

    return {
      migrationsTable: migrationsResult.length > 0,
      expectedTables: expectedTableResults,
      allTablesExist: Object.values(expectedTableResults).every((exists) => exists),
    };
  } finally {
    await client.end();
  }
}
