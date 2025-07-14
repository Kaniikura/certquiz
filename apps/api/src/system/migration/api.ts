/**
 * Programmatic API for database migrations.
 * This allows tests to run migrations without spawning child processes.
 */
import { Result } from '@api/shared/result';
import { sql } from 'drizzle-orm';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import * as dbRepo from './db-repository';
import {
  executeRollback,
  findLastMigration,
  validateDownMigration,
  withDatabaseConnection,
  withMigrationLock,
} from './migrate-down-helpers';
import { analyzeMigrations } from './runtime';

/**
 * Run migrations up (apply all pending migrations)
 */
export async function migrateUp(connectionUrl: string): Promise<Result<void, string>> {
  return withDatabaseConnection(connectionUrl, async (ctx) => {
    return withMigrationLock(ctx, async () => {
      try {
        await migrate(ctx.db, { migrationsFolder: ctx.migrationsPath });
      } catch (error) {
        throw new Error(`Migration failed: ${error}`);
      }
    });
  });
}

/**
 * Run migration down (rollback last migration)
 */
export async function migrateDown(connectionUrl: string): Promise<Result<void, string>> {
  return withDatabaseConnection(connectionUrl, async (ctx) => {
    return withMigrationLock(ctx, async () => {
      // Use helper to find last migration
      const lastResult = await findLastMigration(ctx, false); // debug = false for API
      if (!lastResult.success) {
        throw new Error(lastResult.error);
      }

      if (!lastResult.data) {
        return; // No migrations to roll back
      }

      const meta = lastResult.data;

      // Use helper to validate down migration
      const contentResult = await validateDownMigration(meta, false); // debug = false for API
      if (!contentResult.success) {
        throw new Error(contentResult.error);
      }

      // Execute rollback with custom SqlRunner for transaction handling
      await ctx.db.transaction(async (tx) => {
        const rollbackResult = await executeRollback(
          meta,
          contentResult.data,
          false, // debug = false for API
          async (sqlText) => {
            await tx.execute(sql.raw(sqlText));
          } // SqlRunner implementation
        );
        if (!rollbackResult.success) {
          throw new Error(rollbackResult.error);
        }

        // Remove migration record within the same transaction
        const deleteResult = await dbRepo.deleteMigrationRecord(tx, meta.hash);
        if (!deleteResult.success) {
          throw new Error(`Failed to remove migration record: ${deleteResult.error.type}`);
        }
      });
    });
  });
}

/**
 * Get migration status
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
  try {
    return await withDatabaseConnection(connectionUrl, async (ctx) => {
      const analysisResult = await analyzeMigrations(ctx);

      if (!analysisResult.success) {
        return Result.err(analysisResult.error);
      }

      const analysis = analysisResult.data;

      // Map applied hashes to filenames
      const appliedFilenames = analysis.appliedRecords.map(
        (record) =>
          analysis.hashByFile.get(record.hash) ||
          `<unknown - hash: ${record.hash.substring(0, 8)}...>`
      );

      return Result.ok({
        applied: appliedFilenames,
        pending: analysis.pendingFiles,
        missingDown: analysis.missingDownFiles,
      });
    });
  } catch (error) {
    return Result.err(
      `Failed to get migration status: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}
