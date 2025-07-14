/**
 * Programmatic API for database migrations.
 * This allows tests to run migrations without spawning child processes.
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Result } from '@api/shared/result';
import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import * as dbRepo from './db-repository';
import * as fileRepo from './file-repository';
import { analyzeMigrations, type MigrationContext } from './runtime';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Define migrations path as a single constant to avoid duplication
const MIGRATIONS_PATH = path.join(__dirname, '../../infra/db/migrations');

interface ApiMigrationContext extends MigrationContext {
  client: postgres.Sql;
}

/**
 * Run migrations up (apply all pending migrations)
 */
export async function migrateUp(connectionUrl: string): Promise<Result<void, string>> {
  const client = postgres(connectionUrl, { max: 1 });
  const db = drizzle(client);

  const ctx: ApiMigrationContext = { db, client, migrationsPath: MIGRATIONS_PATH };

  try {
    const lockResult = await dbRepo.acquireMigrationLock(ctx.db);
    if (!lockResult.success) {
      return Result.err('Another migration is already running');
    }

    try {
      await migrate(ctx.db, { migrationsFolder: ctx.migrationsPath });
      return Result.ok(undefined);
    } catch (error) {
      return Result.err(`Migration failed: ${error}`);
    } finally {
      await dbRepo.releaseMigrationLock(ctx.db);
    }
  } finally {
    await client.end();
  }
}

/**
 * Run migration down (rollback last migration)
 */
export async function migrateDown(connectionUrl: string): Promise<Result<void, string>> {
  const client = postgres(connectionUrl, { max: 1 });
  const db = drizzle(client);

  const ctx: ApiMigrationContext = { db, client, migrationsPath: MIGRATIONS_PATH };

  try {
    const lockResult = await dbRepo.acquireMigrationLock(ctx.db);
    if (!lockResult.success) {
      return Result.err('Another migration is already running');
    }

    try {
      // Get last applied migration
      const lastMigrationResult = await dbRepo.getLastAppliedMigration(ctx.db);
      if (!lastMigrationResult.success) {
        if (lastMigrationResult.error.type === 'TableNotFound') {
          return Result.err('No migrations table found');
        }
        return Result.err(`Failed to get last migration: ${lastMigrationResult.error.type}`);
      }

      if (!lastMigrationResult.data) {
        return Result.ok(undefined); // No migrations to roll back
      }

      // Find migration file by hash
      const fileResult = await fileRepo.findMigrationByHash(
        ctx.migrationsPath,
        lastMigrationResult.data.hash
      );

      if (!fileResult.success || !fileResult.data) {
        return Result.err(
          `Migration file not found for hash: ${lastMigrationResult.data.hash.substring(0, 8)}...`
        );
      }

      const migration = fileResult.data;

      // Check for down migration
      const downPath = path.join(ctx.migrationsPath, `${migration.baseName}.down.sql`);
      const downExistsResult = await fileRepo.fileExists(downPath);

      if (!downExistsResult.success || !downExistsResult.data) {
        return Result.err(`Down migration not found: ${migration.baseName}.down.sql`);
      }

      // Read and execute down migration
      const downContentResult = await fileRepo.readFileContent(downPath);
      if (!downContentResult.success) {
        return Result.err(`Failed to read down migration: ${downContentResult.error.type}`);
      }

      // Execute rollback in transaction
      await db.transaction(async (tx) => {
        // Execute the entire SQL file as a single statement
        // This correctly handles semicolons in strings and comments
        await tx.execute(sql.raw(downContentResult.data));

        // Remove migration record within the same transaction
        if (!lastMigrationResult.data) {
          throw new Error('Migration data is unexpectedly null');
        }
        const deleteResult = await dbRepo.deleteMigrationRecord(tx, lastMigrationResult.data.hash);
        if (!deleteResult.success) {
          throw new Error(`Failed to remove migration record: ${deleteResult.error.type}`);
        }
      });

      return Result.ok(undefined);
    } catch (error) {
      return Result.err(`Rollback failed: ${error}`);
    } finally {
      await dbRepo.releaseMigrationLock(ctx.db);
    }
  } finally {
    await client.end();
  }
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
  const client = postgres(connectionUrl, { max: 1 });
  const db = drizzle(client);

  try {
    const ctx: MigrationContext = { db, migrationsPath: MIGRATIONS_PATH };
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
  } finally {
    await client.end();
  }
}
