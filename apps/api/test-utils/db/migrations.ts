import { exec } from 'node:child_process';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';
import postgres from 'postgres';

// Simple mutex to prevent concurrent migrations
let migrationMutex: Promise<void> = Promise.resolve();

const execAsync = promisify(exec);

/**
 * Execute a function with mutex protection to prevent concurrent migrations
 */
async function withMigrationMutex<T>(fn: () => Promise<T>): Promise<T> {
  const currentMutex = migrationMutex;
  let resolveMutex: (() => void) | undefined;

  migrationMutex = new Promise<void>((resolve) => {
    resolveMutex = resolve;
  });

  try {
    await currentMutex;
    return await fn();
  } finally {
    resolveMutex?.();
  }
}

/**
 * Check if migrations directory has SQL files
 */
async function hasMigrationsToRun(): Promise<boolean> {
  const migrationsDir = path.join(__dirname, '../../src/infra/db/migrations');

  try {
    const files = await fs.readdir(migrationsDir);
    return files.some((file) => file.endsWith('.sql'));
  } catch (_error) {
    // Directory doesn't exist or can't be read
    return false;
  }
}

/**
 * Execute drizzle-kit migrate with environment isolation
 */
async function executeMigration(databaseUrl: string): Promise<void> {
  const originalDatabaseUrl = process.env.DATABASE_URL;

  try {
    // Set DATABASE_URL for drizzle-kit to use
    process.env.DATABASE_URL = databaseUrl;

    // Run migrations using drizzle-kit
    const { stderr } = await execAsync('bun run db:migrate', {
      cwd: path.join(__dirname, '../..'),
    });

    if (stderr) {
      if (stderr.includes('No migrations to run')) {
        console.log('ℹ️ No migrations to run - database is already up to date');
      } else if (!stderr.includes('already exists')) {
        // Show actual stderr content for genuine warnings/errors (but ignore "already exists" errors)
        console.warn('Migration stderr:', stderr);
      }
    }
  } finally {
    // Always restore original DATABASE_URL
    if (originalDatabaseUrl !== undefined) {
      process.env.DATABASE_URL = originalDatabaseUrl;
    } else {
      delete process.env.DATABASE_URL;
    }
  }
}

/**
 * Handle migration errors with appropriate recovery strategies
 */
async function handleMigrationError(error: unknown, databaseUrl: string): Promise<void> {
  const errorMessage = error instanceof Error ? error.message : 'Unknown error';
  const isTypeConflictError =
    errorMessage.includes('already exists') ||
    errorMessage.includes('pg_type_typname_nsp_index') ||
    errorMessage.includes('duplicate key value violates unique constraint');
  const isDatabaseNotFoundError =
    errorMessage.includes('database') && errorMessage.includes('does not exist');

  if (isTypeConflictError) {
    console.log(
      'ℹ️ Database types/objects already exist (concurrent migration) - continuing with test table creation'
    );
    await createTestTablesDirectly(databaseUrl);
  } else if (isDatabaseNotFoundError) {
    console.log(
      'ℹ️ Database was removed during migration (concurrent test cleanup) - skipping migration'
    );
    // Don't attempt to create test tables if the database doesn't exist
  } else {
    // Log the actual error details for debugging
    console.error('❌ Migration failed with error:', {
      message: errorMessage,
      stack: error instanceof Error ? error.stack : undefined,
      stderr: error instanceof Error && 'stderr' in error ? error.stderr : undefined,
      stdout: error instanceof Error && 'stdout' in error ? error.stdout : undefined,
      databaseUrl: databaseUrl.replace(/password=[^&]*/, 'password=***'),
    });
    throw new Error(`Failed to run migrations: ${errorMessage}`);
  }
}

/**
 * Run Drizzle migrations against a database URL
 * This runs migrations inside a fresh database, not during container bootstrap
 * @internal - Use createTestDatabase from core.ts instead
 */
export async function drizzleMigrate(databaseUrl: string): Promise<void> {
  return withMigrationMutex(async () => {
    // First, reset the schema to ensure clean state
    await resetMigrationState(databaseUrl);

    // Check if migrations directory has SQL files
    const hasValidMigrations = await hasMigrationsToRun();

    if (!hasValidMigrations) {
      // No production migrations yet, but create test tables
      await createTestTablesDirectly(databaseUrl);
      return;
    }

    try {
      await executeMigration(databaseUrl);
      // Also create test-specific tables
      await createTestTablesDirectly(databaseUrl);
    } catch (error) {
      await handleMigrationError(error, databaseUrl);
    }
  });
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
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const isTypeConflictError =
      errorMessage.includes('already exists') ||
      errorMessage.includes('pg_type_typname_nsp_index') ||
      errorMessage.includes('duplicate key value violates unique constraint');

    if (isTypeConflictError) {
      console.log('ℹ️ Test tables/types already exist (concurrent creation) - continuing');
    } else {
      throw new Error(`Failed to create test tables: ${errorMessage}`);
    }
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
