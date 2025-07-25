/**
 * Seed orchestrator
 * @fileoverview Main seed execution logic that coordinates all feature seeds
 */

import { down as progressDown, up as progressUp } from '@api/features/auth/seed/progress.seed';
import { down as userDown, up as userUp } from '@api/features/auth/seed/users.seed';
import type { DB } from '@api/infra/db/client';
import * as schema from '@api/infra/db/schema';
import { getRootLogger } from '@api/infra/logger';
import type { LoggerPort } from '@api/shared/logger';
import { Result } from '@api/shared/result';
import { sql } from 'drizzle-orm';

// Seed function type
type SeedFunction = (db: DB, logger: LoggerPort) => Promise<Result<void, Error>>;

// Seed module interface
interface SeedModule {
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

    // Load seed modules in dependency order
    const seedModules = loadSeedModules();

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

    // Define explicit truncation order respecting foreign key dependencies
    // Order: from leaf tables (most dependent) to root tables (no dependencies)
    const truncationOrder = [
      // Leaf tables - depend on multiple other tables
      schema.bookmarks, // depends on authUser and question

      // Tables that depend on question
      schema.questionVersion, // depends on question

      // Tables that depend only on authUser
      schema.quizSessionSnapshot, // depends on authUser
      schema.userProgress, // depends on authUser
      schema.subscriptions, // depends on authUser
      schema.question, // depends on authUser (createdById)

      // Event sourcing table (no FK dependencies)
      schema.quizSessionEvent,

      // Root table
      schema.authUser, // no dependencies

      // System tables (only truncate if explicitly needed)
      // webhookEvent, drizzleMigrations, testMigration are typically not seeded
    ];

    // Truncate tables in the defined order
    await db.transaction(async (trx) => {
      // Disable foreign key checks temporarily by setting session_replication_role to 'replica'
      // This PostgreSQL-specific setting disables triggers including foreign key constraint checks
      // While the CASCADE option in TRUNCATE handles dependencies, disabling FK checks ensures:
      // 1. No constraint violations during truncation even with circular dependencies
      // 2. Faster execution as constraint checks are skipped
      // 3. The ability to truncate in any order (though we still follow dependency order as best practice)
      // Note: This is safe in a controlled seed/test environment but should never be used in production
      await trx.execute(sql`SET session_replication_role = 'replica'`);

      for (const table of truncationOrder) {
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
function loadSeedModules(): SeedModule[] {
  const modules: SeedModule[] = [];

  // Auth/User seeds (must be first - other data depends on users)
  modules.push({
    name: 'users',
    up: userUp,
    down: userDown,
  });

  modules.push({
    name: 'user-progress',
    up: progressUp,
    down: progressDown,
  });

  // TODO: Add question seeds when implemented
  // import { up as questionUp, down as questionDown } from '@api/features/question/seed/questions.seed';
  // modules.push({
  //   name: 'questions',
  //   up: questionUp,
  //   down: questionDown,
  // });

  return modules;
}
