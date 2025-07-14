/**
 * Helper functions for migration rollback operations
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { withTransaction } from '@api/infra/unit-of-work';
import { Result } from '@api/shared/result';
import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as dbRepo from './db-repository';
import * as fileRepo from './file-repository';
import type { MigrationContext } from './runtime';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Migration constants
export const MIGRATIONS_PATH = path.join(__dirname, '../../infra/db/migrations');

// SQL execution abstraction for different transaction contexts
export type SqlRunner = (sql: string) => Promise<void>;

export interface MigrationMeta {
  hash: string;
  filename: string;
  baseName: string;
  downPath: string;
}

/**
 * Manages database connection lifecycle for migration operations
 */
export async function withDatabaseConnection<T>(
  connectionUrl: string,
  operation: (ctx: MigrationContext & { client: postgres.Sql }) => Promise<T>
): Promise<T> {
  const client = postgres(connectionUrl, { max: 1 });
  const db = drizzle(client);
  const ctx = { db, client, migrationsPath: MIGRATIONS_PATH };

  try {
    return await operation(ctx);
  } finally {
    await client.end();
  }
}

/**
 * Manages migration lock acquisition and release
 */
export async function withMigrationLock<T>(
  ctx: MigrationContext,
  operation: () => Promise<T>
): Promise<Result<T, string>> {
  const lockResult = await dbRepo.acquireMigrationLock(ctx.db);
  if (!lockResult.success) {
    return Result.err('Another migration is already running');
  }

  try {
    const result = await operation();
    return Result.ok(result);
  } finally {
    await dbRepo.releaseMigrationLock(ctx.db);
  }
}

/**
 * Find the last applied migration and its metadata
 */
export async function findLastMigration(
  ctx: MigrationContext,
  debug: boolean
): Promise<Result<MigrationMeta | null, string>> {
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
    return Result.ok(null);
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

  const downPath = path.join(ctx.migrationsPath, `${migration.baseName}.down.sql`);

  return Result.ok({
    hash: lastMigrationResult.data.hash,
    filename: migration.filename,
    baseName: migration.baseName,
    downPath,
  });
}

/**
 * Validate that the down migration file exists
 */
export async function validateDownMigration(
  meta: MigrationMeta,
  debug: boolean
): Promise<Result<string, string>> {
  if (debug) console.log(`[DEBUG] Checking for down migration at: ${meta.downPath}`);

  const downExistsResult = await fileRepo.fileExists(meta.downPath);
  if (!downExistsResult.success || !downExistsResult.data) {
    return Result.err(`Down migration not found: ${meta.baseName}.down.sql`);
  }

  // Read down migration content
  if (debug) console.log('[DEBUG] Reading down migration content...');
  const downContentResult = await fileRepo.readFileContent(meta.downPath);
  if (!downContentResult.success) {
    return Result.err(`Failed to read down migration: ${downContentResult.error.type}`);
  }

  return Result.ok(downContentResult.data);
}

/**
 * Execute the rollback within a transaction
 * CLI version: uses withTransaction from infra layer
 */
export async function executeRollback(
  meta: MigrationMeta,
  sqlContent: string,
  debug: boolean
): Promise<Result<void, string>>;

/**
 * Execute the rollback with custom SQL runner
 * API version: uses provided SqlRunner for transaction handling
 */
export async function executeRollback(
  meta: MigrationMeta,
  sqlContent: string,
  debug: boolean,
  run: SqlRunner
): Promise<Result<void, string>>;

/**
 * Implementation of executeRollback with overloads
 */
export async function executeRollback(
  meta: MigrationMeta,
  sqlContent: string,
  debug: boolean,
  run?: SqlRunner
): Promise<Result<void, string>> {
  if (debug) console.log('[DEBUG] Starting rollback transaction...');

  try {
    if (run) {
      // API version: use provided SqlRunner for custom transaction handling
      if (debug) console.log('[DEBUG] Using provided SqlRunner...');
      await run(sqlContent);
      if (debug) console.log('[DEBUG] SQL migration executed via SqlRunner');
      // Note: API version handles migration record deletion in its own transaction
    } else {
      // CLI version: use withTransaction with complete rollback logic
      await withTransaction(async (tx) => {
        // Execute the entire SQL file as a single statement
        if (debug) console.log('[DEBUG] Executing SQL migration file...');
        await tx.execute(sql.raw(sqlContent));
        if (debug) console.log('[DEBUG] SQL migration executed successfully');

        // Remove migration record within the same transaction
        if (debug) console.log('[DEBUG] Removing migration record from database...');
        const deleteResult = await dbRepo.deleteMigrationRecord(tx, meta.hash);
        if (!deleteResult.success) {
          throw new Error(`Failed to remove migration record: ${deleteResult.error.type}`);
        }
        if (debug) console.log('[DEBUG] Migration record removed successfully');
      });
    }

    if (debug) console.log(`✅ Rolled back migration: ${meta.baseName}`);
    return Result.ok(undefined);
  } catch (error) {
    if (debug) console.log(`[DEBUG] Rollback failed with error: ${error}`);
    return Result.err(`Rollback failed: ${error}`);
  }
}
