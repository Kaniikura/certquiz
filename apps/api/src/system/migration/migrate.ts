#!/usr/bin/env bun
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Result } from '@api/shared/result';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import * as dbRepo from './db-repository';
import { executeRollback, findLastMigration, validateDownMigration } from './migrate-down-helpers';
import { analyzeMigrations, formatList, type MigrationContext } from './runtime';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Types
type MigrationCommand = 'up' | 'down' | 'status';

interface CliMigrationContext extends MigrationContext {
  client: postgres.Sql;
}

// Command implementations
async function runUp(ctx: CliMigrationContext): Promise<Result<void, string>> {
  console.log('🚀 Running migrations...');

  const lockResult = await dbRepo.acquireMigrationLock(ctx.db);
  if (!lockResult.success) {
    return Result.err('Another migration is already running');
  }

  try {
    await migrate(ctx.db, { migrationsFolder: ctx.migrationsPath });
    console.log('✅ Migrations completed successfully');
    return Result.ok(undefined);
  } catch (error) {
    return Result.err(`Migration failed: ${error}`);
  } finally {
    await dbRepo.releaseMigrationLock(ctx.db);
  }
}

async function runDown(ctx: CliMigrationContext): Promise<Result<void, string>> {
  console.log('🔄 Rolling back last migration...');
  const debug = process.env.DEBUG_MIGRATION === 'true';
  if (debug) console.log('[DEBUG] Acquiring migration lock...');

  const lockResult = await dbRepo.acquireMigrationLock(ctx.db);
  if (!lockResult.success) {
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
    if (debug) console.log('[DEBUG] Releasing migration lock...');
    await dbRepo.releaseMigrationLock(ctx.db);
    if (debug) console.log('[DEBUG] Migration lock released');
  }
}

async function runStatus(ctx: MigrationContext): Promise<Result<void, string>> {
  console.log('📊 Migration Status\n');

  const analysisResult = await analyzeMigrations(ctx);
  if (!analysisResult.success) {
    return Result.err(analysisResult.error);
  }

  const analysis = analysisResult.data;

  // Display applied migrations
  console.log('✅ Applied migrations:');
  if (analysis.appliedRecords.length === 0) {
    console.log('   (none)');
  } else {
    for (const record of analysis.appliedRecords) {
      const filename =
        analysis.hashByFile.get(record.hash) ||
        `<unknown - hash: ${record.hash.substring(0, 8)}...>`;
      const date = record.createdAt.toLocaleString();
      console.log(`   - ${filename.replace('.sql', '')} (applied: ${date})`);
    }
  }

  // Display pending migrations
  console.log('\n⏳ Pending migrations:');
  console.log(formatList(analysis.pendingFiles.map((f) => f.replace('.sql', ''))));

  // Display missing down migrations
  console.log('\n⚠️  Missing down migrations:');
  console.log(formatList(analysis.missingDownFiles));

  return Result.ok(undefined);
}

// CLI function that can be called from scripts
export async function cli(args: string[] = process.argv.slice(2)) {
  const debug = process.env.DEBUG_MIGRATION === 'true';
  const command = args[0] as MigrationCommand;

  if (!command || !['up', 'down', 'status'].includes(command)) {
    console.error('Usage: migrate [up|down|status]');
    throw new Error('Invalid command');
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('Error: DATABASE_URL environment variable is required');
    throw new Error('DATABASE_URL not set');
  }

  // Setup context
  if (debug) console.log('[DEBUG] Creating database connection...');
  const client = postgres(databaseUrl, { max: 1 });
  const db = drizzle(client);
  const migrationsPath = path.join(__dirname, '../../infra/db/migrations');

  const ctx: CliMigrationContext = { db, client, migrationsPath };

  try {
    let result: Result<void, string>;

    if (debug) console.log(`[DEBUG] Executing command: ${command}`);
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
    if (debug) console.log('[DEBUG] Command completed successfully');
  } finally {
    if (debug) console.log('[DEBUG] Closing database connection...');
    await client.end();
    if (debug) console.log('[DEBUG] Database connection closed');
  }
}

// Support direct execution for development
if (import.meta.url === `file://${process.argv[1]}`) {
  cli().catch((err) => {
    console.error('❌ Error:', err.message);
    process.exit(1);
  });
}
