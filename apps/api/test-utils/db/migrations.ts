import { exec } from 'node:child_process';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';
import postgres from 'postgres';

const execAsync = promisify(exec);

/**
 * Run Drizzle migrations against a database URL
 * This runs migrations inside a fresh database, not during container bootstrap
 * @internal - Use createTestDatabase from core.ts instead
 */
export async function drizzleMigrate(databaseUrl: string): Promise<void> {
  // First, reset the schema to ensure clean state
  await resetMigrationState(databaseUrl);

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
    await createTestTablesDirectly(databaseUrl);
    return;
  }

  try {
    // Set DATABASE_URL for drizzle-kit to use
    const env = {
      ...process.env,
      DATABASE_URL: databaseUrl,
    };

    // Run migrations using drizzle-kit
    const { stderr } = await execAsync('bun run db:migrate', {
      cwd: path.join(__dirname, '../..'),
      env,
    });

    if (stderr) {
      if (stderr.includes('No migrations to run')) {
        console.log('ℹ️ No migrations to run - database is already up to date');
      } else if (!stderr.includes('already exists')) {
        // Show actual stderr content for genuine warnings/errors (but ignore "already exists" errors)
        console.warn('Migration stderr:', stderr);
      }
    }

    // Also create test-specific tables
    await createTestTablesDirectly(databaseUrl);
  } catch (error) {
    // If the error is about types already existing, try to continue
    if (error instanceof Error && error.message.includes('already exists')) {
      console.log('ℹ️ Database types already exist - continuing with test table creation');
      await createTestTablesDirectly(databaseUrl);
    } else {
      throw new Error(
        `Failed to run migrations: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }
}

/**
 * Create test-specific tables that are not part of production schema
 * Uses direct postgres connection instead of container.exec()
 * @internal
 */
async function createTestTablesDirectly(databaseUrl: string): Promise<void> {
  const client = postgres(databaseUrl, { max: 1 });

  try {
    // Create test_migration table for migration testing
    await client`
      CREATE TABLE IF NOT EXISTS test_migration (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;

    // Create test_users table for infrastructure testing
    await client`
      CREATE TABLE IF NOT EXISTS test_users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        is_active BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;
  } catch (error) {
    throw new Error(
      `Failed to create test tables: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  } finally {
    await client.end();
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
