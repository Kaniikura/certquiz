#!/usr/bin/env bun
/**
 * Local Migration Test Script
 *
 * Runs the same migration tests as the GitHub Actions workflow locally.
 * This helps catch migration issues before pushing to CI.
 *
 * Test sequence:
 * 1. Check migration files (db:check)
 * 2. Run migrations on empty database (db:migrate)
 * 3. Drop all database objects (db:drop)
 * 4. Run migrations again (db:migrate)
 * 5. Verify idempotency (db:migrate again)
 *
 * Usage: bun run db:test:migration
 */

import { exec } from 'node:child_process';
import { setTimeout } from 'node:timers/promises';

// ============================================================================
// Types and Interfaces
// ============================================================================

interface TestStep {
  name: string;
  command: string;
  description: string;
  critical?: boolean;
}

interface TestResult {
  step: string;
  success: boolean;
  duration: number;
  error?: string;
}

interface Logger {
  info: (message: string) => void;
  error: (message: string) => void;
  success: (message: string) => void;
  step: (message: string) => void;
  result: (message: string, success: boolean) => void;
}

// ============================================================================
// Constants
// ============================================================================

const COLORS = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
} as const;

const EXIT_CODES = {
  SUCCESS: 0,
  CONFIGURATION_ERROR: 1,
  TEST_FAILURE: 2,
  COMMAND_ERROR: 3,
} as const;

const TEST_STEPS: TestStep[] = [
  {
    name: 'Check Migration Files',
    command: 'bun run db:check',
    description: 'Validating migration files with drizzle-kit',
    critical: true,
  },
  {
    name: 'Initial Migration',
    command: 'bun run db:migrate',
    description: 'Running migrations on empty database',
    critical: true,
  },
  {
    name: 'Drop Database',
    command: 'CI=true bun run db:drop',
    description: 'Dropping all database objects',
    critical: true,
  },
  {
    name: 'Re-run Migration',
    command: 'bun run db:migrate',
    description: 'Running migrations again after drop',
    critical: true,
  },
  {
    name: 'Verify Idempotency',
    command: 'bun run db:migrate',
    description: 'Verifying migrations are idempotent',
    critical: false,
  },
];

// ============================================================================
// Logger Implementation
// ============================================================================

const logger: Logger = {
  info: (message: string) => console.log(`${COLORS.blue}ℹ${COLORS.reset}  ${message}`),

  error: (message: string) => console.error(`${COLORS.red}✖${COLORS.reset}  ${message}`),

  success: (message: string) => console.log(`${COLORS.green}✓${COLORS.reset}  ${message}`),

  step: (message: string) =>
    console.log(`\n${COLORS.cyan}▶${COLORS.reset}  ${COLORS.bright}${message}${COLORS.reset}`),

  result: (message: string, success: boolean) => {
    const icon = success ? `${COLORS.green}✓` : `${COLORS.red}✖`;
    const color = success ? COLORS.green : COLORS.red;
    console.log(`  ${icon}${COLORS.reset} ${color}${message}${COLORS.reset}`);
  },
};

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Formats duration in milliseconds to a human-readable string
 */
function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${ms}ms`;
  }
  return `${(ms / 1000).toFixed(2)}s`;
}

/**
 * Validates that DATABASE_URL is set
 */
function validateEnvironment(): string {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl || databaseUrl.trim().length === 0) {
    throw new Error('DATABASE_URL environment variable is not set');
  }

  // Warn if using production database
  if (databaseUrl.includes('prod') || !databaseUrl.includes('localhost')) {
    logger.info(
      `${COLORS.yellow}⚠${COLORS.reset}  Warning: DATABASE_URL doesn't appear to be a local database`
    );
    logger.info('  Consider using a local PostgreSQL instance for testing');
  }

  return databaseUrl;
}

/**
 * Runs a command and captures output
 */
async function runCommand(command: string): Promise<{ success: boolean; error?: string }> {
  return new Promise((resolve) => {
    exec(command, { env: { ...process.env } }, (error, stdout, stderr) => {
      if (error) {
        const errorMessage = stderr || stdout || error.message;
        resolve({
          success: false,
          error: errorMessage.trim(),
        });
      } else {
        resolve({ success: true });
      }
    });
  });
}

/**
 * Runs a single test step
 */
async function runTestStep(step: TestStep): Promise<TestResult> {
  logger.step(`${step.name}`);
  logger.info(step.description);

  const startTime = Date.now();

  try {
    const result = await runCommand(step.command);
    const duration = Date.now() - startTime;

    if (result.success) {
      logger.result(`Completed in ${formatDuration(duration)}`, true);
      return {
        step: step.name,
        success: true,
        duration,
      };
    } else {
      logger.result(`Failed: ${result.error}`, false);
      return {
        step: step.name,
        success: false,
        duration,
        error: result.error,
      };
    }
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.result(`Error: ${errorMessage}`, false);
    return {
      step: step.name,
      success: false,
      duration,
      error: errorMessage,
    };
  }
}

/**
 * Prints test summary
 */
function printSummary(results: TestResult[]): void {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`${COLORS.bright}Migration Test Summary${COLORS.reset}`);
  console.log('='.repeat(60));

  const totalDuration = results.reduce((sum, r) => sum + r.duration, 0);
  const successCount = results.filter((r) => r.success).length;
  const failureCount = results.filter((r) => !r.success).length;

  results.forEach((result) => {
    const status = result.success
      ? `${COLORS.green}PASS${COLORS.reset}`
      : `${COLORS.red}FAIL${COLORS.reset}`;
    const duration = `${COLORS.cyan}${formatDuration(result.duration)}${COLORS.reset}`;
    console.log(`  ${status} ${result.step} (${duration})`);
    if (!result.success && result.error) {
      console.log(`       ${COLORS.red}└─ ${result.error}${COLORS.reset}`);
    }
  });

  console.log('='.repeat(60));
  console.log(`Total: ${successCount} passed, ${failureCount} failed`);
  console.log(`Duration: ${formatDuration(totalDuration)}`);
  console.log('='.repeat(60));
}

// ============================================================================
// Main Function
// ============================================================================

async function main(): Promise<void> {
  console.log(`${COLORS.bright}🧪 Migration Test Runner${COLORS.reset}`);
  console.log('Running migration tests locally...\n');

  try {
    // Validate environment
    validateEnvironment();

    const results: TestResult[] = [];
    let shouldContinue = true;

    // Run each test step
    for (const step of TEST_STEPS) {
      if (!shouldContinue && step.critical) {
        logger.step(`${step.name}`);
        logger.info(`${COLORS.yellow}Skipped due to previous failure${COLORS.reset}`);
        results.push({
          step: step.name,
          success: false,
          duration: 0,
          error: 'Skipped due to previous critical failure',
        });
        continue;
      }

      const result = await runTestStep(step);
      results.push(result);

      // Stop on critical failures
      if (!result.success && step.critical) {
        shouldContinue = false;
      }

      // Small delay between steps for better output readability
      await setTimeout(100);
    }

    // Print summary
    printSummary(results);

    // Exit with appropriate code
    const allPassed = results.every((r) => r.success);
    if (allPassed) {
      logger.success('\nAll migration tests passed! ✨');
      process.exit(EXIT_CODES.SUCCESS);
    } else {
      logger.error('\nSome migration tests failed. Please fix the issues and try again.');
      process.exit(EXIT_CODES.TEST_FAILURE);
    }
  } catch (error) {
    logger.error(`Configuration error: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(EXIT_CODES.CONFIGURATION_ERROR);
  }
}

// ============================================================================
// Script Entry Point
// ============================================================================

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
