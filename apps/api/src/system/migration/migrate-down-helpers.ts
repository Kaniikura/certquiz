/**
 * Helper functions for migration rollback operations
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getRootLogger } from '@api/infra/logger';
import { withTransaction } from '@api/infra/unit-of-work';
import { isResult, Result } from '@api/shared/result';
import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as dbRepo from './db-repository';
import * as fileRepo from './file-repository';
import type { MigrationContext } from './runtime';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Create logger for migration helpers
const logger = getRootLogger().child({ module: 'migration.helpers' });

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
 * Overload 1: For operations that return a Result (more specific, must come first)
 */
export async function withDatabaseConnection<T, E>(
  connectionUrl: string,
  operation: (ctx: MigrationContext & { client: postgres.Sql }) => Promise<Result<T, E>>
): Promise<Result<T, string | E>>;

/**
 * Manages database connection lifecycle for migration operations
 * Overload 2: For operations that return a plain value
 */
export async function withDatabaseConnection<T>(
  connectionUrl: string,
  operation: (ctx: MigrationContext & { client: postgres.Sql }) => Promise<T>
): Promise<Result<T, string>>;

/**
 * Implementation that handles both plain values and Results
 */
export async function withDatabaseConnection(
  connectionUrl: string,
  operation: (ctx: MigrationContext & { client: postgres.Sql }) => Promise<unknown>
): Promise<Result<unknown, string>> {
  let client: postgres.Sql | undefined;

  try {
    client = postgres(connectionUrl, { max: 1 });
    const db = drizzle(client);
    const ctx = { db, client, migrationsPath: MIGRATIONS_PATH };

    const value = await operation(ctx);

    // Auto-flatten if the callback returns a Result
    if (isResult(value)) {
      return value as Result<unknown, string>;
    }

    return Result.ok(value);
  } catch (e) {
    return Result.err(e instanceof Error ? e.message : String(e));
  } finally {
    // Never let a failed shutdown clobber the real error
    try {
      if (client) await client.end();
    } catch {
      /* ignore cleanup errors */
    }
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
  } catch (error) {
    return Result.err(error instanceof Error ? error.message : String(error));
  } finally {
    try {
      await dbRepo.releaseMigrationLock(ctx.db);
    } catch {
      /* ignore cleanup errors */
    }
  }
}

/**
 * Find the last applied migration and its metadata
 */
export async function findLastMigration(
  ctx: MigrationContext,
  debug: boolean
): Promise<Result<MigrationMeta | null, string>> {
  if (debug) logger.debug('Getting last applied migration');

  const lastMigrationResult = await dbRepo.getLastAppliedMigration(ctx.db);
  if (!lastMigrationResult.success) {
    if (lastMigrationResult.error.type === 'TableNotFound') {
      return Result.err('No migrations table found');
    }
    return Result.err(`Failed to get last migration: ${lastMigrationResult.error.type}`);
  }

  if (!lastMigrationResult.data) {
    logger.info('No migrations to roll back');
    return Result.ok(null);
  }

  if (debug) logger.debug('Found migration to rollback', { hash: lastMigrationResult.data.hash });

  // Find migration file by hash
  if (debug) logger.debug('Finding migration file by hash');
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
  if (debug) logger.debug('Found migration file', { filename: migration.filename });

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
  if (debug) logger.debug('Checking for down migration', { downPath: meta.downPath });

  const downExistsResult = await fileRepo.fileExists(meta.downPath);
  if (!downExistsResult.success || !downExistsResult.data) {
    return Result.err(`Down migration not found: ${meta.baseName}.down.sql`);
  }

  // Read down migration content
  if (debug) logger.debug('Reading down migration content');
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
  if (debug) logger.debug('Starting rollback transaction');

  try {
    if (run) {
      // API version: use provided SqlRunner for custom transaction handling
      if (debug) logger.debug('Using provided SqlRunner');
      await run(sqlContent);
      if (debug) logger.debug('SQL migration executed via SqlRunner');
      // Note: API version handles migration record deletion in its own transaction
    } else {
      // CLI version: use withTransaction with complete rollback logic
      await withTransaction(async (tx) => {
        // Execute the entire SQL file as a single statement
        if (debug) logger.debug('Executing SQL migration file');
        await tx.execute(sql.raw(sqlContent));
        if (debug) logger.debug('SQL migration executed successfully');

        // Remove migration record within the same transaction
        if (debug) logger.debug('Removing migration record from database');
        const deleteResult = await dbRepo.deleteMigrationRecord(tx, meta.hash);
        if (!deleteResult.success) {
          throw new Error(`Failed to remove migration record: ${deleteResult.error.type}`);
        }
        if (debug) logger.debug('Migration record removed successfully');
      });
    }

    logger.info('Rolled back migration successfully', { baseName: meta.baseName });
    return Result.ok(undefined);
  } catch (error) {
    logger.error('Rollback failed', {
      baseName: meta.baseName,
      error: error instanceof Error ? error.message : String(error),
    });
    return Result.err(`Rollback failed: ${error}`);
  }
}
