#!/usr/bin/env bun
/**
 * Seed CLI
 * @fileoverview Command-line interface for database seeding
 */

import { db } from '@api/infra/db/client';
import { getRootLogger } from '@api/infra/logger';
import { Result } from '@api/shared/result';
import { clearSeed, resetSeed, runSeed } from './run';

// Create logger for CLI operations
const logger = getRootLogger().child({ module: 'seed-cli' });

// Types
type SeedCommand = 'seed' | 'clear' | 'reset';

// Command implementations
async function executeSeed(): Promise<Result<void, string>> {
  logger.info('Running database seed');
  const result = await runSeed(db, logger);
  if (!result.success) {
    return Result.err(result.error.message);
  }
  return Result.ok(undefined);
}

async function executeClear(): Promise<Result<void, string>> {
  logger.info('Clearing seed data');
  const result = await clearSeed(db, logger);
  if (!result.success) {
    return Result.err(result.error.message);
  }
  return Result.ok(undefined);
}

async function executeReset(): Promise<Result<void, string>> {
  logger.info('Resetting seed data');
  const result = await resetSeed(db, logger);
  if (!result.success) {
    return Result.err(result.error.message);
  }
  return Result.ok(undefined);
}

// CLI function that can be called from scripts
export async function cli(args: string[] = process.argv.slice(2)) {
  const command = args[0] as SeedCommand;

  if (!command || !['seed', 'clear', 'reset'].includes(command)) {
    const helpMessage = `
Usage: bun run seed.ts <command>

Commands:
  seed    - Add seed data to the database
  clear   - Remove all seed data
  reset   - Clear then re-seed the database

Example:
  bun run seed.ts seed
  bun run seed.ts clear
  bun run seed.ts reset
`;

    logger.error('Invalid command provided', {
      command,
      validCommands: ['seed', 'clear', 'reset'],
      help: helpMessage,
    });

    // CLI tools need stderr output for user feedback
    process.stderr.write(helpMessage);
    throw new Error('Invalid command');
  }

  // Guard against production
  if (process.env.NODE_ENV === 'production') {
    logger.error('Seed operations are not allowed in production');
    throw new Error('Cannot run seed operations in production environment');
  }

  try {
    let result: Result<void, string>;

    logger.debug(`Executing command: ${command}`);
    switch (command) {
      case 'seed':
        result = await executeSeed();
        break;
      case 'clear':
        result = await executeClear();
        break;
      case 'reset':
        result = await executeReset();
        break;
      default:
        result = Result.err(`Unknown command: ${command}`);
    }

    if (!result.success) {
      throw new Error(result.error);
    }

    logger.info(`Command '${command}' completed successfully`);
  } catch (error) {
    logger.error(`Command '${command}' failed`, {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    throw error;
  }
}

// Support direct execution for development
if (import.meta.url === `file://${process.argv[1]}`) {
  cli().catch((err) => {
    logger.error('Seed CLI error', {
      error: err.message,
      stack: err.stack,
    });
    process.exit(1);
  });
}
