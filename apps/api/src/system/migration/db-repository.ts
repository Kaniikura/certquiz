import { createDomainLogger } from '@api/infra/logger/PinoLoggerAdapter';
import { Result } from '@api/shared/result';
import { sql } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';

// Types
export interface MigrationRecord {
  hash: string;
  createdAt: Date;
}

export class InvalidDateError extends Error {
  constructor(value: unknown, reason?: string) {
    const message = reason
      ? `Invalid date value: ${String(value)} (${reason})`
      : `Invalid date value: ${String(value)}`;
    super(message);
    this.name = 'InvalidDateError';
  }
}

export type DbError =
  | { type: 'DatabaseError'; operation: string; reason: unknown }
  | { type: 'TableNotFound' }
  | { type: 'ConcurrentMigration' }
  | { type: 'MigrationNotFound'; hash: string };

const MIGRATION_LOCK_ID = 974652;

// Create logger for migration database operations
const logger = createDomainLogger('migration.db-repository');

// Helper to parse dates from various formats
function parseDate(value: string | number | Date): Date {
  if (value instanceof Date) return value;
  if (typeof value === 'string') {
    // Check if it's a numeric string (timestamp)
    const numericValue = Number(value);
    if (!Number.isNaN(numericValue)) {
      const date = new Date(numericValue);
      if (!Number.isNaN(date.getTime())) {
        return date;
      }
    }
    // Try parsing as date string
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) {
      return date;
    }
    logger.error('Invalid date string', { value });
    throw new InvalidDateError(value, 'string format not recognized');
  }
  const date = new Date(Number(value));
  if (Number.isNaN(date.getTime())) {
    logger.error('Invalid date number', { value });
    throw new InvalidDateError(value, 'number cannot be converted to valid date');
  }
  return date;
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
  logger.debug('Getting last applied migration');

  try {
    const rows = await db.execute<{ hash: string; created_at: string | number | Date }>(
      sql`SELECT hash, created_at 
          FROM drizzle.__drizzle_migrations
          ORDER BY created_at DESC 
          LIMIT 1`
    );

    if (rows.length === 0) {
      logger.debug('No migrations found');
      return Result.ok(null);
    }

    const record = {
      hash: rows[0].hash,
      createdAt: parseDate(rows[0].created_at),
    };

    logger.debug('Found last migration', {
      hash: record.hash,
      createdAt: record.createdAt.toISOString(),
    });
    return Result.ok(record);
  } catch (error) {
    if (isTableNotExistsError(error)) {
      logger.warn('Migration table does not exist');
      return Result.err({ type: 'TableNotFound' });
    }
    logger.error('Failed to get last applied migration', {
      error: error instanceof Error ? error.message : String(error),
    });
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
  logger.debug('Attempting to acquire migration lock', { lockId: MIGRATION_LOCK_ID });

  try {
    const rows = await db.execute<{ acquired: boolean }>(
      sql`SELECT pg_try_advisory_lock(${MIGRATION_LOCK_ID}) as acquired`
    );
    const acquired = rows[0]?.acquired ?? false;

    if (!acquired) {
      logger.warn('Failed to acquire migration lock - another migration is running');
      return Result.err({ type: 'ConcurrentMigration' });
    }

    logger.info('Migration lock acquired successfully');
    return Result.ok(undefined);
  } catch (error) {
    logger.error('Failed to acquire migration lock', {
      error: error instanceof Error ? error.message : String(error),
      lockId: MIGRATION_LOCK_ID,
    });
    return Result.err({ type: 'DatabaseError', operation: 'acquireLock', reason: error });
  }
}

export async function releaseMigrationLock(db: PostgresJsDatabase): Promise<Result<void, DbError>> {
  logger.debug('Releasing migration lock', { lockId: MIGRATION_LOCK_ID });

  try {
    await db.execute(sql`SELECT pg_advisory_unlock(${MIGRATION_LOCK_ID})`);
    logger.info('Migration lock released successfully');
    return Result.ok(undefined);
  } catch (error) {
    logger.error('Failed to release migration lock', {
      error: error instanceof Error ? error.message : String(error),
      lockId: MIGRATION_LOCK_ID,
    });
    return Result.err({ type: 'DatabaseError', operation: 'releaseLock', reason: error });
  }
}

// Export internals for testing
export const __internal__ = {
  parseDate,
  isTableNotExistsError,
};
