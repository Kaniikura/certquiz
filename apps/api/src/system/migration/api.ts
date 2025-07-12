/**
 * Programmatic API for database migrations.
 * This allows tests to run migrations without spawning child processes.
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Result } from '@api/shared/result';
import { sql } from 'drizzle-orm';
import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import * as dbRepo from './db-repository';
import * as fileRepo from './file-repository';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Define migrations path as a single constant to avoid duplication
const MIGRATIONS_PATH = path.join(__dirname, '../../infra/db/migrations');

interface MigrationContext {
  db: PostgresJsDatabase;
  client: postgres.Sql;
  migrationsPath: string;
}

/**
 * Run migrations up (apply all pending migrations)
 */
export async function migrateUp(connectionUrl: string): Promise<Result<void, string>> {
  const client = postgres(connectionUrl, { max: 1 });
  const db = drizzle(client);

  const ctx: MigrationContext = { db, client, migrationsPath: MIGRATIONS_PATH };

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

  const ctx: MigrationContext = { db, client, migrationsPath: MIGRATIONS_PATH };

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
    // Get migration files
    const filesResult = await fileRepo.listMigrationFiles(MIGRATIONS_PATH);
    if (!filesResult.success) {
      return Result.err(`Failed to list migration files: ${filesResult.error.type}`);
    }

    const upMigrations = filesResult.data.filter((f) => f.type === 'up');

    // Get applied migrations
    const appliedResult = await dbRepo.getAllAppliedMigrations(db);
    const applied = appliedResult.success ? appliedResult.data : [];
    const appliedHashes = new Set(applied.map((a) => a.hash));

    // Build file hash map
    const fileHashMap = new Map<string, string>();
    const pending: string[] = [];

    for (const file of upMigrations) {
      const hashResult = await fileRepo.calculateFileHash(file.path);
      if (hashResult.success) {
        fileHashMap.set(hashResult.data, file.filename);
        if (!appliedHashes.has(hashResult.data)) {
          pending.push(file.filename);
        }
      }
    }

    // Check for missing down migrations
    const missingDown: string[] = [];
    for (const file of upMigrations) {
      if (!file.baseName.includes('.irrev')) {
        const hasDownResult = await fileRepo.hasDownMigration(MIGRATIONS_PATH, file.baseName);
        if (hasDownResult.success && !hasDownResult.data) {
          missingDown.push(`${file.baseName}.down.sql`);
        }
      }
    }

    // Map applied migrations to filenames
    const appliedFilenames = applied.map(
      (migration) =>
        fileHashMap.get(migration.hash) || `<unknown - hash: ${migration.hash.substring(0, 8)}...>`
    );

    return Result.ok({
      applied: appliedFilenames,
      pending,
      missingDown,
    });
  } finally {
    await client.end();
  }
}
