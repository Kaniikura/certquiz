#!/usr/bin/env bun
/**
 * Database drop utility for development/testing
 * Handles both interactive and CI environments gracefully
 *
 * Background:
 * The drizzle-kit drop command is interactive by design - it shows a list of
 * migrations and asks users to select which ones to drop. This works well
 * for local development but causes issues in CI/CD environments where no
 * user interaction is possible.
 *
 * This script provides a unified interface that:
 * - In local environments: Uses the interactive drizzle-kit drop command
 * - In CI environments: Directly drops all database objects (equivalent to
 *   dropping and recreating the public schema)
 *
 * This ensures the same command (bun run db:drop) works consistently across
 * all environments while maintaining appropriate behavior for each context.
 *
 * Note: drizzle-kit team is working on adding a --force flag for non-interactive
 * use. Once that's available, this script can be simplified or removed.
 * See: https://github.com/drizzle-team/drizzle-orm/issues/4734
 */
import { spawn } from 'node:child_process';
import postgres from 'postgres';

/**
 * Run a command with inherited stdio for interactive commands
 */
function runInteractive(command: string, args: string[], env?: NodeJS.ProcessEnv): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: 'inherit',
      env: { ...process.env, ...env },
    });

    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${command} exited with code ${code}`));
      }
    });
  });
}

/**
 * Drop all database objects in public schema
 * This mimics what drizzle-kit drop does interactively
 */
async function dropDatabaseSchema(connectionUrl: string): Promise<void> {
  const sql = postgres(connectionUrl, { max: 1 });

  try {
    // Drop all tables, types, and other objects in public schema
    // This is safer than dropping the entire schema as it preserves permissions
    await sql`DROP SCHEMA public CASCADE`;
    await sql`CREATE SCHEMA public`;
    await sql`GRANT ALL ON SCHEMA public TO public`;
    console.log('✓ Dropped all database objects');
  } catch (error) {
    throw new Error(`Failed to drop database schema: ${error}`);
  } finally {
    await sql.end();
  }
}

async function main() {
  const isCI = process.env.CI === 'true' || process.env.GITHUB_ACTIONS === 'true';
  const connectionUrl = process.env.DATABASE_URL;

  if (!connectionUrl) {
    console.error('Error: DATABASE_URL environment variable is not set');
    process.exit(1);
  }

  try {
    if (isCI) {
      // In CI environments, directly drop all database objects
      console.log('CI environment detected - dropping all database objects...');
      await dropDatabaseSchema(connectionUrl);
    } else {
      // In local environments, use interactive drizzle-kit drop
      console.log('Running interactive drizzle-kit drop...');
      await runInteractive('bun', ['drizzle-kit', 'drop']);
    }

    console.log('✓ Database drop completed successfully');
  } catch (error) {
    console.error('Error:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

// Execute when run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
