#!/usr/bin/env bun
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getRootLogger } from '@api/infra/logger';
import { Result } from '@api/shared/result';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import * as dbRepo from './db-repository';
import { executeRollback, findLastMigration, validateDownMigration } from './migrate-down-helpers';
import { analyzeMigrations, type MigrationContext } from './runtime';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Create logger for migration operations
const logger = getRootLogger().child({ module: 'migration' });

// Types
type MigrationCommand = 'up' | 'down' | 'status';

interface CliMigrationContext extends MigrationContext {
  client: postgres.Sql;
}

// Command implementations
async function runUp(ctx: CliMigrationContext): Promise<Result<void, string>> {
  logger.info('Running database migrations', { path: ctx.migrationsPath });

  const lockResult = await dbRepo.acquireMigrationLock(ctx.db);
  if (!lockResult.success) {
    logger.warn('Failed to acquire migration lock - another migration is already running');
    return Result.err('Another migration is already running');
  }

  try {
    await migrate(ctx.db, { migrationsFolder: ctx.migrationsPath });
    logger.info('Migrations completed successfully');
    return Result.ok(undefined);
  } catch (error) {
    logger.error('Migration failed', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return Result.err(`Migration failed: ${error}`);
  } finally {
    await dbRepo.releaseMigrationLock(ctx.db);
  }
}

async function runDown(ctx: CliMigrationContext): Promise<Result<void, string>> {
  logger.info('Rolling back last migration');
  const debug = process.env.DEBUG_MIGRATION === 'true';
  if (debug) logger.debug('Acquiring migration lock');

  const lockResult = await dbRepo.acquireMigrationLock(ctx.db);
  if (!lockResult.success) {
    logger.warn('Failed to acquire migration lock - another migration is already running');
    return Result.err('Another migration is already running');
  }

  try {
    // Find last migration
    const migrationResult = await findLastMigration(ctx, debug);
    if (!migrationResult.success) {
      return Result.err(migrationResult.error);
    }

    if (!migrationResult.data) {
      return Result.ok(undefined); // No migrations to roll back
    }

    const meta = migrationResult.data;

    // Validate down migration exists and get content
    const contentResult = await validateDownMigration(meta, debug);
    if (!contentResult.success) {
      return Result.err(contentResult.error);
    }

    // Execute rollback
    const rollbackResult = await executeRollback(meta, contentResult.data, debug);
    if (!rollbackResult.success) {
      return Result.err(rollbackResult.error);
    }

    return Result.ok(undefined);
  } finally {
    if (debug) logger.debug('[DEBUG] Releasing migration lock...');
    await dbRepo.releaseMigrationLock(ctx.db);
    if (debug) logger.debug('[DEBUG] Migration lock released');
  }
}

async function runStatus(ctx: MigrationContext): Promise<Result<void, string>> {
  logger.info('Checking migration status');

  const analysisResult = await analyzeMigrations(ctx);
  if (!analysisResult.success) {
    logger.error('Failed to analyze migrations', { error: analysisResult.error });
    return Result.err(analysisResult.error);
  }

  const analysis = analysisResult.data;

  // Log status summary
  logger.info('Migration status summary', {
    applied: analysis.appliedRecords.length,
    pending: analysis.pendingFiles.length,
    missingDown: analysis.missingDownFiles.length,
  });

  // Applied migrations
  if (analysis.appliedRecords.length === 0) {
    logger.info('No migrations have been applied');
  } else {
    const appliedList = analysis.appliedRecords.map((record) => {
      const filename =
        analysis.hashByFile.get(record.hash) ||
        `<unknown - hash: ${record.hash.substring(0, 8)}...>`;
      return {
        migration: filename.replace('.sql', ''),
        appliedAt: record.createdAt.toISOString(),
        hash: record.hash,
      };
    });
    logger.info('Applied migrations', { migrations: appliedList });
  }

  // Pending migrations
  if (analysis.pendingFiles.length > 0) {
    logger.info('Pending migrations', {
      migrations: analysis.pendingFiles.map((f) => f.replace('.sql', '')),
    });
  }

  // Missing down migrations
  if (analysis.missingDownFiles.length > 0) {
    logger.warn('Missing down migrations', {
      migrations: analysis.missingDownFiles,
    });
  }

  return Result.ok(undefined);
}

// CLI function that can be called from scripts
export async function cli(args: string[] = process.argv.slice(2)) {
  const debug = process.env.DEBUG_MIGRATION === 'true';
  const command = args[0] as MigrationCommand;

  if (!command || !['up', 'down', 'status'].includes(command)) {
    logger.error('Invalid command provided', { command, validCommands: ['up', 'down', 'status'] });
    throw new Error('Invalid command');
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    logger.error('DATABASE_URL environment variable is required');
    throw new Error('DATABASE_URL not set');
  }

  // Setup context
  if (debug) logger.debug('[DEBUG] Creating database connection...');
  const client = postgres(databaseUrl, { max: 1 });
  const db = drizzle(client);
  const migrationsPath = path.join(__dirname, '../../infra/db/migrations');

  const ctx: CliMigrationContext = { db, client, migrationsPath };

  try {
    let result: Result<void, string>;

    if (debug) logger.debug(`[DEBUG] Executing command: ${command}`);
    switch (command) {
      case 'up':
        result = await runUp(ctx);
        break;
      case 'down':
        result = await runDown(ctx);
        break;
      case 'status':
        result = await runStatus(ctx);
        break;
      default:
        result = Result.err(`Unknown command: ${command}`);
    }

    if (!result.success) {
      throw new Error(result.error);
    }
    if (debug) logger.debug('[DEBUG] Command completed successfully');
  } finally {
    if (debug) logger.debug('[DEBUG] Closing database connection...');
    await client.end();
    if (debug) logger.debug('[DEBUG] Database connection closed');
  }
}

// Support direct execution for development
if (import.meta.url === `file://${process.argv[1]}`) {
  cli().catch((err) => {
    logger.error('Migration CLI error', {
      error: err.message,
      stack: err.stack,
    });
    process.exit(1);
  });
}
