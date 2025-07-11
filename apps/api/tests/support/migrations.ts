import { exec } from 'node:child_process';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';
import type { StartedPostgreSqlContainer } from '@testcontainers/postgresql';

const execAsync = promisify(exec);

/**
 * Run Drizzle migrations against a test container
 */
export async function drizzleMigrate(container: StartedPostgreSqlContainer): Promise<void> {
  const connectionUri = container.getConnectionUri();

  // Check if migrations directory exists
  const migrationsDir = path.join(__dirname, '../../db/migrations');
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
      console.warn('Migration warnings:', stderr);
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
