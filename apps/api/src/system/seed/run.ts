/**
 * Seed orchestrator
 * @fileoverview Main seed execution logic that coordinates all feature seeds
 */

import type { DB } from '@api/infra/db/client';
import * as schema from '@api/infra/db/schema';
import { getRootLogger } from '@api/infra/logger';
import type { LoggerPort } from '@api/shared/logger';
import { Result } from '@api/shared/result';
import { sql } from 'drizzle-orm';

// Seed function type
export type SeedFunction = (db: DB, logger: LoggerPort) => Promise<Result<void, Error>>;

// Seed module interface
export interface SeedModule {
  up: SeedFunction;
  down: SeedFunction;
  name: string;
}

/**
 * Run all seed functions in order
 */
export async function runSeed(db: DB, logger?: LoggerPort): Promise<Result<void, Error>> {
  const log = logger ?? getRootLogger().child({ module: 'seed' });

  try {
    log.info('Starting database seeding');

    // Import seed modules dynamically to avoid circular dependencies
    const seedModules = await loadSeedModules();

    // Run seeds in transaction
    await db.transaction(async (trx) => {
      for (const module of seedModules) {
        log.info(`Running seed: ${module.name}`);
        const result = await module.up(trx, log);

        if (!result.success) {
          throw new Error(`Seed ${module.name} failed: ${result.error.message}`);
        }

        log.info(`Completed seed: ${module.name}`);
      }
    });

    log.info('Database seeding completed successfully');
    return Result.ok(undefined);
  } catch (error) {
    log.error('Database seeding failed', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return Result.err(new Error(`Seeding failed: ${error}`));
  }
}

/**
 * Clear all seed data by truncating tables
 */
export async function clearSeed(db: DB, logger?: LoggerPort): Promise<Result<void, Error>> {
  const log = logger ?? getRootLogger().child({ module: 'seed' });

  try {
    log.info('Starting seed data cleanup');

    // Get all table names from schema
    const tableNames = Object.keys(schema).filter(
      (key) =>
        // biome-ignore lint/performance/noDynamicNamespaceImportAccess: Dev-only script. Dynamic lookup keeps the file
        typeof schema[key as keyof typeof schema] === 'object' &&
        // biome-ignore lint/performance/noDynamicNamespaceImportAccess: Dev-only script. Dynamic lookup keeps the file
        'tableName' in schema[key as keyof typeof schema]
    );

    // Truncate tables in reverse dependency order
    await db.transaction(async (trx) => {
      // Disable foreign key checks temporarily
      await trx.execute(sql`SET session_replication_role = 'replica'`);

      for (const tableName of tableNames.reverse()) {
        // biome-ignore lint/performance/noDynamicNamespaceImportAccess: Dev-only script. Dynamic lookup keeps the file
        const table = schema[tableName as keyof typeof schema];
        if ('tableName' in table && typeof table.tableName === 'string') {
          log.debug(`Truncating table: ${table.tableName}`);
          await trx.execute(sql`TRUNCATE TABLE ${sql.identifier(table.tableName)} CASCADE`);
        }
      }

      // Re-enable foreign key checks
      await trx.execute(sql`SET session_replication_role = 'origin'`);
    });

    log.info('Seed data cleanup completed successfully');
    return Result.ok(undefined);
  } catch (error) {
    log.error('Seed data cleanup failed', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return Result.err(new Error(`Clear seed failed: ${error}`));
  }
}

/**
 * Reset seed data (clear then seed)
 */
export async function resetSeed(db: DB, logger?: LoggerPort): Promise<Result<void, Error>> {
  const log = logger ?? getRootLogger().child({ module: 'seed' });

  log.info('Resetting seed data');

  // Clear existing data
  const clearResult = await clearSeed(db, log);
  if (!clearResult.success) {
    return clearResult;
  }

  // Seed fresh data
  const seedResult = await runSeed(db, log);
  if (!seedResult.success) {
    return seedResult;
  }

  log.info('Seed data reset completed');
  return Result.ok(undefined);
}

/**
 * Load seed modules in dependency order
 * Add new seed modules here as they are implemented
 */
async function loadSeedModules(): Promise<SeedModule[]> {
  const modules: SeedModule[] = [];

  // Auth/User seeds (must be first - other data depends on users)
  const userSeed = await import('@api/features/auth/seed/users.seed');
  modules.push({
    name: 'users',
    up: userSeed.up,
    down: userSeed.down,
  });

  const progressSeed = await import('@api/features/auth/seed/progress.seed');
  modules.push({
    name: 'user-progress',
    up: progressSeed.up,
    down: progressSeed.down,
  });

  // TODO: Add question seeds when implemented
  // const questionSeed = await import('@api/features/question/seed/questions.seed');
  // modules.push({
  //   name: 'questions',
  //   up: questionSeed.up,
  //   down: questionSeed.down,
  // });

  return modules;
}
