import { Result } from '@api/shared/result';
import { sql } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';

// Types
export interface MigrationRecord {
  hash: string;
  createdAt: Date;
}

export type DbError =
  | { type: 'DatabaseError'; operation: string; reason: unknown }
  | { type: 'TableNotFound' }
  | { type: 'ConcurrentMigration' }
  | { type: 'MigrationNotFound'; hash: string };

const MIGRATION_LOCK_ID = 974652;

// Helper to parse dates from various formats
function parseDate(value: string | number | Date): Date {
  if (value instanceof Date) return value;
  if (typeof value === 'string') return new Date(value);
  return new Date(Number(value));
}

// Check if error is "table does not exist"
function isTableNotExistsError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  if (error && typeof error === 'object' && 'code' in error) {
    return (error as { code?: string }).code === '42P01';
  }
  return false;
}

// Repository functions
export async function getLastAppliedMigration(
  db: PostgresJsDatabase
): Promise<Result<MigrationRecord | null, DbError>> {
  try {
    const rows = await db.execute<{ hash: string; created_at: string | number | Date }>(
      sql`SELECT hash, created_at 
          FROM drizzle.__drizzle_migrations
          ORDER BY created_at DESC 
          LIMIT 1`
    );

    if (rows.length === 0) {
      return Result.ok(null);
    }

    return Result.ok({
      hash: rows[0].hash,
      createdAt: parseDate(rows[0].created_at),
    });
  } catch (error) {
    if (isTableNotExistsError(error)) {
      return Result.err({ type: 'TableNotFound' });
    }
    return Result.err({ type: 'DatabaseError', operation: 'getLastApplied', reason: error });
  }
}

export async function getAllAppliedMigrations(
  db: PostgresJsDatabase
): Promise<Result<MigrationRecord[], DbError>> {
  try {
    const rows = await db.execute<{ hash: string; created_at: string | number | Date }>(
      sql`SELECT hash, created_at 
          FROM drizzle.__drizzle_migrations
          ORDER BY created_at`
    );

    const records: MigrationRecord[] = rows.map((row) => ({
      hash: row.hash,
      createdAt: parseDate(row.created_at),
    }));

    return Result.ok(records);
  } catch (error) {
    if (isTableNotExistsError(error)) {
      return Result.err({ type: 'TableNotFound' });
    }
    return Result.err({ type: 'DatabaseError', operation: 'getAllApplied', reason: error });
  }
}

export async function deleteMigrationRecord(
  db: PostgresJsDatabase,
  hash: string
): Promise<Result<void, DbError>> {
  try {
    const result = await db.execute(
      sql`DELETE FROM drizzle.__drizzle_migrations
          WHERE hash = ${hash}`
    );

    // Check if any rows were affected (postgres.js uses 'count' property)
    const affectedRows = result.count;
    if (affectedRows === 0) {
      return Result.err({ type: 'MigrationNotFound', hash });
    }

    return Result.ok(undefined);
  } catch (error) {
    return Result.err({ type: 'DatabaseError', operation: 'deleteMigration', reason: error });
  }
}

export async function tableExists(db: PostgresJsDatabase): Promise<Result<boolean, DbError>> {
  try {
    const rows = await db.execute<{ exists: boolean }>(
      sql`SELECT to_regclass('drizzle.__drizzle_migrations') IS NOT NULL as exists`
    );
    return Result.ok(rows[0]?.exists ?? false);
  } catch (error) {
    return Result.err({ type: 'DatabaseError', operation: 'tableExists', reason: error });
  }
}

export async function acquireMigrationLock(db: PostgresJsDatabase): Promise<Result<void, DbError>> {
  try {
    const rows = await db.execute<{ acquired: boolean }>(
      sql`SELECT pg_try_advisory_lock(${MIGRATION_LOCK_ID}) as acquired`
    );
    const acquired = rows[0]?.acquired ?? false;

    if (!acquired) {
      return Result.err({ type: 'ConcurrentMigration' });
    }

    return Result.ok(undefined);
  } catch (error) {
    return Result.err({ type: 'DatabaseError', operation: 'acquireLock', reason: error });
  }
}

export async function releaseMigrationLock(db: PostgresJsDatabase): Promise<Result<void, DbError>> {
  try {
    await db.execute(sql`SELECT pg_advisory_unlock(${MIGRATION_LOCK_ID})`);
    return Result.ok(undefined);
  } catch (error) {
    return Result.err({ type: 'DatabaseError', operation: 'releaseLock', reason: error });
  }
}

// Export internals for testing
export const __internal__ = {
  parseDate,
  isTableNotExistsError,
};
