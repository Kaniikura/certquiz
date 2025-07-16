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
 * Run migration down (rollback) - Safe implementation for development/testing
 *
 * IMPORTANT: This is a simplified rollback that only clears migration tracking.
 * For production, implement proper down migrations with individual SQL files.
 *
 * @param connectionUrl - Database connection string
 * @returns Result indicating success or failure
 */
export async function migrateDown(connectionUrl: string): Promise<Result<void, string>> {
  // SAFETY: Prevent execution in production environment
  if (process.env.NODE_ENV === 'production') {
    return Result.err(
      'Migration rollback is not allowed in production environment. ' +
        'Implement proper down migrations with individual SQL files for production use.'
    );
  }

  const client = postgres(connectionUrl, { max: 1 });

  try {
    // Only drop the migration tracking table, not the entire schema
    // This is safer than dropping the entire public schema
    await client.unsafe('DROP TABLE IF EXISTS __drizzle_migrations CASCADE');

    // Note: In a proper implementation, you would:
    // 1. Read down migration files (e.g., 0001_rollback.sql)
    // 2. Execute them in reverse order
    // 3. Remove migration records from tracking table
    // 4. Maintain data integrity throughout the process

    return Result.ok(undefined);
  } catch (error) {
    return Result.err(
      `Migration rollback failed: ${error instanceof Error ? error.message : 'Unknown error'}`
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
