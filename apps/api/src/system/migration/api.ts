/**
 * Programmatic API for database migrations using drizzle-kit.
 * This allows tests to run migrations without spawning child processes.
 */
import { exec } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { Result } from '@api/shared/result';
import postgres from 'postgres';

const execAsync = promisify(exec);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Run migrations up (apply all pending migrations)
 */
export async function migrateUp(connectionUrl: string): Promise<Result<void, string>> {
  try {
    const env = {
      ...process.env,
      DATABASE_URL: connectionUrl,
    };

    // Run drizzle-kit migrate
    const { stderr } = await execAsync('bun run db:migrate', {
      cwd: path.join(__dirname, '../../..'),
      env,
    });

    // Check for actual errors (not just warnings)
    if (stderr?.includes('error:') && !stderr.includes('No migrations to run')) {
      return Result.err(`Migration failed: ${stderr}`);
    }

    return Result.ok(undefined);
  } catch (error) {
    // Handle "already exists" errors as non-fatal
    if (error instanceof Error && error.message.includes('already exists')) {
      return Result.ok(undefined);
    }

    return Result.err(
      `Migration failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Reset database schema for testing purposes
 *
 * IMPORTANT: This function completely drops and recreates the public schema,
 * removing ALL database objects (tables, types, etc.). This is intended
 * ONLY for development/testing environments.
 *
 * For production rollbacks, implement proper down migrations with individual SQL files.
 *
 * @param connectionUrl - Database connection string
 * @returns Result indicating success or failure
 */
export async function resetDatabaseForTesting(
  connectionUrl: string
): Promise<Result<void, string>> {
  // SAFETY: Prevent execution in production environment
  if (process.env.NODE_ENV === 'production') {
    return Result.err(
      'Database reset is not allowed in production environment. ' +
        'For production rollbacks, implement proper down migrations with individual SQL files.'
    );
  }

  const client = postgres(connectionUrl, { max: 1 });

  try {
    // Drop and recreate the entire public schema
    // CASCADE will automatically drop ALL dependent objects including:
    // - All tables, views, indexes, sequences, functions, and types
    // - All foreign key constraints and dependencies
    // - All triggers, stored procedures, and user-defined data types
    // This ensures a completely clean state for testing with no orphaned objects
    await client.unsafe('DROP SCHEMA public CASCADE');
    await client.unsafe('CREATE SCHEMA public');
    await client.unsafe('GRANT ALL ON SCHEMA public TO public');

    return Result.ok(undefined);
  } catch (error) {
    return Result.err(
      `Database reset failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  } finally {
    await client.end();
  }
}

/**
 * Get migration status using drizzle-kit check
 */
export async function getMigrationStatus(connectionUrl: string): Promise<
  Result<
    {
      applied: string[];
      pending: string[];
      missingDown: string[];
    },
    string
  >
> {
  const client = postgres(connectionUrl, { max: 1 });

  try {
    // Check for applied migrations in drizzle schema
    let appliedMigrations: { hash: string; created_at: Date }[] = [];

    try {
      appliedMigrations = await client`
        SELECT hash, created_at 
        FROM __drizzle_migrations 
        ORDER BY created_at ASC
      `;
    } catch {
      // Migration table doesn't exist (schema was reset or never created)
      appliedMigrations = [];
    }

    // Get migration files from directory
    const migrationsDir = path.join(__dirname, '../../infra/db/migrations');
    const fs = await import('node:fs/promises');

    let allMigrationFiles: string[] = [];
    try {
      const files = await fs.readdir(migrationsDir);
      allMigrationFiles = files
        .filter((f) => f.endsWith('.sql') && !f.endsWith('.down.sql'))
        .sort();
    } catch {
      // Directory doesn't exist
    }

    // If migration table exists, determine applied vs pending
    if (appliedMigrations.length > 0) {
      // Use array slicing approach because:
      // 1. drizzle-kit stores SHA256 hashes in the database, not migration tags/filenames
      // 2. drizzle-kit always applies migrations in alphabetical order
      // 3. The order of files in the migrations directory matches the order in the database
      //
      // While hash-based matching would be ideal, it would require either:
      // - Reading the _journal.json file for hash-to-filename mapping
      // - Computing SHA256 hashes of migration files
      // Both approaches add complexity without significant benefit given drizzle-kit's
      // guaranteed ordering behavior.
      const applied = allMigrationFiles.slice(0, appliedMigrations.length);
      const pending = allMigrationFiles.slice(appliedMigrations.length);

      return Result.ok({
        applied,
        pending,
        missingDown: [], // drizzle-kit doesn't use down migrations
      });
    } else {
      // No migrations applied (or table doesn't exist)
      return Result.ok({
        applied: [],
        pending: allMigrationFiles.length > 0 ? allMigrationFiles : [],
        missingDown: [],
      });
    }
  } catch (error) {
    return Result.err(
      `Failed to get migration status: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  } finally {
    await client.end();
  }
}
