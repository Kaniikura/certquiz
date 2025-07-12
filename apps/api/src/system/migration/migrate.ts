#!/usr/bin/env bun
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { withTransaction } from '@api/infra/unit-of-work';
import { Result } from '@api/shared/result';
import { sql } from 'drizzle-orm';
import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import * as dbRepo from './db-repository';
import * as fileRepo from './file-repository';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Types
type MigrationCommand = 'up' | 'down' | 'status';

interface MigrationContext {
  db: PostgresJsDatabase;
  client: postgres.Sql;
  migrationsPath: string;
}

// Command implementations
async function runUp(ctx: MigrationContext): Promise<Result<void, string>> {
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

async function runDown(ctx: MigrationContext): Promise<Result<void, string>> {
  console.log('🔄 Rolling back last migration...');
  const debug = process.env.DEBUG_MIGRATION === 'true';
  if (debug) console.log('[DEBUG] Acquiring migration lock...');

  const lockResult = await dbRepo.acquireMigrationLock(ctx.db);
  if (!lockResult.success) {
    return Result.err('Another migration is already running');
  }

  try {
    // Get last applied migration
    if (debug) console.log('[DEBUG] Getting last applied migration...');
    const lastMigrationResult = await dbRepo.getLastAppliedMigration(ctx.db);
    if (!lastMigrationResult.success) {
      if (lastMigrationResult.error.type === 'TableNotFound') {
        return Result.err('No migrations table found');
      }
      return Result.err(`Failed to get last migration: ${lastMigrationResult.error.type}`);
    }

    if (!lastMigrationResult.data) {
      console.log('ℹ️  No migrations to roll back');
      return Result.ok(undefined);
    }

    if (debug) console.log(`[DEBUG] Found migration to rollback: ${lastMigrationResult.data.hash}`);

    // Find migration file by hash
    if (debug) console.log('[DEBUG] Finding migration file by hash...');
    const fileResult = await fileRepo.findMigrationByHash(
      ctx.migrationsPath,
      lastMigrationResult.data.hash
    );

    if (!fileResult.success) {
      return Result.err(`Failed to find migration file: ${fileResult.error.type}`);
    }

    if (!fileResult.data) {
      return Result.err(
        `Migration file not found for hash: ${lastMigrationResult.data.hash.substring(0, 8)}...`
      );
    }

    const migration = fileResult.data;
    if (debug) console.log(`[DEBUG] Found migration file: ${migration.filename}`);

    // Check for down migration
    const downPath = path.join(ctx.migrationsPath, `${migration.baseName}.down.sql`);
    if (debug) console.log(`[DEBUG] Checking for down migration at: ${downPath}`);
    const downExistsResult = await fileRepo.fileExists(downPath);

    if (!downExistsResult.success || !downExistsResult.data) {
      return Result.err(`Down migration not found: ${migration.baseName}.down.sql`);
    }

    // Read and execute down migration
    if (debug) console.log('[DEBUG] Reading down migration content...');
    const downContentResult = await fileRepo.readFileContent(downPath);
    if (!downContentResult.success) {
      return Result.err(`Failed to read down migration: ${downContentResult.error.type}`);
    }

    // Execute rollback in transaction
    if (debug) console.log('[DEBUG] Starting rollback transaction...');
    try {
      await withTransaction(async (tx) => {
        // Execute the entire SQL file as a single statement
        // This correctly handles semicolons in strings and comments
        if (debug) console.log('[DEBUG] Executing SQL migration file...');
        await tx.execute(sql.raw(downContentResult.data));
        if (debug) console.log('[DEBUG] SQL migration executed successfully');

        // Remove migration record within the same transaction
        if (debug) console.log('[DEBUG] Removing migration record from database...');
        if (!lastMigrationResult.data) {
          throw new Error('Migration data is unexpectedly null');
        }
        const deleteResult = await dbRepo.deleteMigrationRecord(tx, lastMigrationResult.data.hash);
        if (!deleteResult.success) {
          throw new Error(`Failed to remove migration record: ${deleteResult.error.type}`);
        }
        if (debug) console.log('[DEBUG] Migration record removed successfully');
      });

      console.log(`✅ Rolled back migration: ${migration.baseName}`);
      return Result.ok(undefined);
    } catch (error) {
      if (debug) console.log(`[DEBUG] Rollback failed with error: ${error}`);
      return Result.err(`Rollback failed: ${error}`);
    }
  } finally {
    if (debug) console.log('[DEBUG] Releasing migration lock...');
    await dbRepo.releaseMigrationLock(ctx.db);
    if (debug) console.log('[DEBUG] Migration lock released');
  }
}

async function runStatus(ctx: MigrationContext): Promise<Result<void, string>> {
  console.log('📊 Migration Status\n');

  // Get migration files
  const filesResult = await fileRepo.listMigrationFiles(ctx.migrationsPath);
  if (!filesResult.success) {
    return Result.err(`Failed to list migration files: ${filesResult.error.type}`);
  }

  const upMigrations = filesResult.data.filter((f) => f.type === 'up');

  // Get applied migrations
  const appliedResult = await dbRepo.getAllAppliedMigrations(ctx.db);
  const applied = appliedResult.success ? appliedResult.data : [];
  const appliedHashes = new Set(applied.map((a) => a.hash));

  // Calculate file hashes once and store both hash and filename
  const fileHashMap = new Map<string, string>();
  const pending: string[] = [];

  for (const file of upMigrations) {
    const hashResult = await fileRepo.calculateFileHash(file.path);
    if (hashResult.success) {
      fileHashMap.set(hashResult.data, file.filename);
      // Check if this migration is pending while we have the hash
      if (!appliedHashes.has(hashResult.data)) {
        pending.push(file.filename);
      }
    }
  }

  // Display applied migrations
  console.log('✅ Applied migrations:');
  if (applied.length === 0) {
    console.log('   (none)');
  } else {
    for (const migration of applied) {
      const filename =
        fileHashMap.get(migration.hash) || `<unknown - hash: ${migration.hash.substring(0, 8)}...>`;
      const date = migration.createdAt.toLocaleString();
      console.log(`   - ${filename.replace('.sql', '')} (applied: ${date})`);
    }
  }
  // Display pending migrations
  console.log('\n⏳ Pending migrations:');
  if (pending.length === 0) {
    console.log('   (none)');
  } else {
    for (const filename of pending) {
      console.log(`   - ${filename.replace('.sql', '')}`);
    }
  }
  const missingDown: string[] = [];

  for (const file of upMigrations) {
    if (!file.baseName.includes('.irrev')) {
      const hasDownResult = await fileRepo.hasDownMigration(ctx.migrationsPath, file.baseName);
      if (hasDownResult.success && !hasDownResult.data) {
        missingDown.push(`${file.baseName}.down.sql`);
      }
    }
  }
  // Display missing down migrations
  console.log('\n⚠️  Missing down migrations:');
  if (missingDown.length === 0) {
    console.log('   (none)');
  } else {
    for (const filename of missingDown) {
      console.log(`   - ${filename}`);
    }
  }

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
  const migrationsPath = path.join(__dirname, '../../../db/migrations');

  const ctx: MigrationContext = { db, client, migrationsPath };

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
