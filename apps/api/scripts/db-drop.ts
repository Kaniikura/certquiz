#!/usr/bin/env bun
/**
 * Database drop utility for development/testing
 * Handles both interactive and CI environments gracefully
 *
 * Background:
 * The drizzle-kit drop command is interactive by design - it shows a list of
 * migrations and asks users to select which ones to drop. This works well
 * for local development but causes issues in CI/CD environments where no
 * user interaction is possible.
 *
 * This script provides a unified interface that:
 * - In local environments: Uses the interactive drizzle-kit drop command
 * - In CI environments: Directly drops all database objects (equivalent to
 *   dropping and recreating the public schema)
 *
 * This ensures the same command (bun run db:drop) works consistently across
 * all environments while maintaining appropriate behavior for each context.
 *
 * Note: drizzle-kit team is working on adding a --force flag for non-interactive
 * use. Once that's available, this script can be simplified or removed.
 * See: https://github.com/drizzle-team/drizzle-orm/issues/4734
 */
import { spawn } from 'node:child_process';
import { resetDatabaseForTesting } from '@api/system/migration/api';

// ============================================================================
// Types and Interfaces
// ============================================================================

interface Environment {
  isCI: boolean;
  nodeEnv: string | undefined;
}

interface Config {
  databaseUrl: string;
  environment: Environment;
}

interface Logger {
  info: (message: string) => void;
  error: (message: string, error?: unknown) => void;
  success: (message: string) => void;
}

// ============================================================================
// Constants
// ============================================================================

const EXIT_CODES = {
  SUCCESS: 0,
  CONFIGURATION_ERROR: 1,
  DATABASE_ERROR: 2,
  COMMAND_ERROR: 3,
} as const;

const ENV_VARS = {
  DATABASE_URL: 'DATABASE_URL',
  CI: 'CI',
  GITHUB_ACTIONS: 'GITHUB_ACTIONS',
  NODE_ENV: 'NODE_ENV',
} as const;

const NODE_ENV_VALUES = {
  PRODUCTION: 'production',
  TEST: 'test',
} as const;

// ============================================================================
// Error Classes
// ============================================================================

class ConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigurationError';
  }
}

class DatabaseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DatabaseError';
  }
}

class CommandError extends Error {
  constructor(
    message: string,
    public readonly exitCode: number
  ) {
    super(message);
    this.name = 'CommandError';
  }
}

// ============================================================================
// Logger Implementation
// ============================================================================

const logger: Logger = {
  info: (message: string) => console.log(message),
  error: (message: string, error?: unknown) => {
    console.error(`Error: ${message}`);
    if (error instanceof Error) {
      console.error(error.message);
    } else if (error !== undefined) {
      console.error(String(error));
    }
  },
  success: (message: string) => console.log(`✓ ${message}`),
};

// ============================================================================
// Pure Functions
// ============================================================================

/**
 * Detects the current environment based on environment variables
 */
function detectEnvironment(): Environment {
  return {
    isCI: process.env[ENV_VARS.CI] === 'true' || process.env[ENV_VARS.GITHUB_ACTIONS] === 'true',
    nodeEnv: process.env[ENV_VARS.NODE_ENV],
  };
}

/**
 * Validates and returns the database URL from environment variables
 * @throws {ConfigurationError} If DATABASE_URL is not set or empty
 */
function validateDatabaseUrl(): string {
  const url = process.env[ENV_VARS.DATABASE_URL];

  if (!url || url.trim().length === 0) {
    throw new ConfigurationError(
      `${ENV_VARS.DATABASE_URL} environment variable is not set or empty`
    );
  }

  return url;
}

/**
 * Creates and validates the configuration
 * @throws {ConfigurationError} If configuration is invalid
 */
function createConfig(): Config {
  return {
    databaseUrl: validateDatabaseUrl(),
    environment: detectEnvironment(),
  };
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Temporarily modifies NODE_ENV and ensures it's restored
 * @param tempValue - Temporary value for NODE_ENV
 * @param fn - Function to execute with the temporary NODE_ENV
 */
async function withTemporaryNodeEnv<T>(tempValue: string, fn: () => Promise<T>): Promise<T> {
  const originalValue = process.env[ENV_VARS.NODE_ENV];
  process.env[ENV_VARS.NODE_ENV] = tempValue;

  try {
    return await fn();
  } finally {
    if (originalValue === undefined) {
      delete process.env[ENV_VARS.NODE_ENV];
    } else {
      process.env[ENV_VARS.NODE_ENV] = originalValue;
    }
  }
}

/**
 * Runs a command with inherited stdio for interactive commands
 * @param command - Command to run
 * @param args - Command arguments
 * @throws {CommandError} If the command exits with non-zero code
 */
async function runInteractiveCommand(command: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: 'inherit',
      env: process.env,
    });

    child.on('error', (error) => {
      reject(
        new CommandError(`Failed to start ${command}: ${error.message}`, EXIT_CODES.COMMAND_ERROR)
      );
    });

    child.on('exit', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new CommandError(`${command} exited with code ${code}`, EXIT_CODES.COMMAND_ERROR));
      }
    });
  });
}

// ============================================================================
// Business Logic Functions
// ============================================================================

/**
 * Drops the database in CI environment using resetDatabaseForTesting
 * @param databaseUrl - Database connection URL
 * @param environment - Current environment
 * @throws {DatabaseError} If database reset fails
 */
async function dropDatabaseInCI(databaseUrl: string, environment: Environment): Promise<void> {
  logger.info('CI environment detected - dropping all database objects...');

  // Ensure we're not in production for safety
  const shouldOverrideNodeEnv = environment.nodeEnv === NODE_ENV_VALUES.PRODUCTION;

  const executeReset = async () => {
    const result = await resetDatabaseForTesting(databaseUrl);
    if (!result.success) {
      throw new DatabaseError(result.error);
    }
  };

  if (shouldOverrideNodeEnv) {
    await withTemporaryNodeEnv(NODE_ENV_VALUES.TEST, executeReset);
  } else {
    await executeReset();
  }

  logger.success('Dropped all database objects');
}

/**
 * Runs the interactive drizzle-kit drop command for local development
 * @throws {CommandError} If the command fails
 */
async function runInteractiveDrop(): Promise<void> {
  logger.info('Running interactive drizzle-kit drop...');
  await runInteractiveCommand('bun', ['drizzle-kit', 'drop']);
}

// ============================================================================
// Main Function
// ============================================================================

/**
 * Main entry point for the database drop utility
 */
async function main(): Promise<void> {
  try {
    const config = createConfig();

    if (config.environment.isCI) {
      await dropDatabaseInCI(config.databaseUrl, config.environment);
    } else {
      await runInteractiveDrop();
    }

    logger.success('Database drop completed successfully');
    process.exit(EXIT_CODES.SUCCESS);
  } catch (error) {
    if (error instanceof ConfigurationError) {
      logger.error('Configuration error', error);
      process.exit(EXIT_CODES.CONFIGURATION_ERROR);
    } else if (error instanceof DatabaseError) {
      logger.error('Database operation failed', error);
      process.exit(EXIT_CODES.DATABASE_ERROR);
    } else if (error instanceof CommandError) {
      logger.error('Command execution failed', error);
      process.exit(error.exitCode);
    } else {
      logger.error('Unexpected error', error);
      process.exit(EXIT_CODES.COMMAND_ERROR);
    }
  }
}

// ============================================================================
// Script Entry Point
// ============================================================================

// Execute when run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
