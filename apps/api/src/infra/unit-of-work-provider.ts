/**
 * Unit of Work Provider
 * @fileoverview Factory for creating Unit of Work instances based on environment
 *
 * This provider determines whether to use real database transactions
 * or fake in-memory implementations based on the current environment.
 */

import { FakeUnitOfWorkFactory } from '@api/testing/domain/fakes';
import type { IUnitOfWork } from './db/IUnitOfWork';
import type { Logger } from './logger';
import { createDomainLogger } from './logger/PinoLoggerAdapter';

/**
 * Environment configuration for Unit of Work
 */
export interface UnitOfWorkConfig {
  /**
   * Force using fake implementation regardless of NODE_ENV
   * Useful for integration tests that don't need real DB
   */
  useFake?: boolean;

  /**
   * Custom logger instance
   * If not provided, creates a domain logger
   */
  logger?: Logger;
}

/**
 * Global fake factory instance for test environments
 * Allows tests to access and manipulate fake repositories
 */
let globalFakeFactory: FakeUnitOfWorkFactory | null = null;

/**
 * Get the global fake factory instance
 * Creates one if it doesn't exist
 */
export function getGlobalFakeFactory(): FakeUnitOfWorkFactory {
  if (!globalFakeFactory) {
    globalFakeFactory = new FakeUnitOfWorkFactory();
  }
  return globalFakeFactory;
}

/**
 * Reset the global fake factory
 * Useful for test cleanup
 */
export function resetGlobalFakeFactory(): void {
  if (globalFakeFactory) {
    globalFakeFactory.clear();
  }
  globalFakeFactory = null;
}

/**
 * Creates a Unit of Work instance based on environment
 *
 * Decision logic:
 * 1. If config.useFake is true -> FakeUnitOfWork
 * 2. If NODE_ENV is 'test' -> FakeUnitOfWork
 * 3. Otherwise -> DrizzleUnitOfWork with real transaction
 *
 * @param config - Configuration options
 * @returns Unit of Work instance
 */
export async function createUnitOfWork(config: UnitOfWorkConfig = {}): Promise<IUnitOfWork> {
  const logger = config.logger || createDomainLogger('unit-of-work.provider');

  // Determine if we should use fake implementation
  const shouldUseFake = config.useFake || process.env.NODE_ENV === 'test';

  if (shouldUseFake) {
    logger.debug('Creating fake Unit of Work for test environment');
    const fakeFactory = getGlobalFakeFactory();
    return fakeFactory.create();
  }

  // For production/development, the middleware pattern doesn't work well with Drizzle's transaction model
  // This is a known limitation of the current architecture
  // Real transactions should use TxRunner in routes or the full migration to IUnitOfWork pattern
  logger.warn('Real Unit of Work creation not supported in middleware pattern');
  throw new Error(
    'Real Unit of Work requires proper transaction management. ' +
      'Use TxRunner in routes for production or set useFake=true for tests. ' +
      'This will be resolved in Step 2 of the migration.'
  );
}

/**
 * NOTE: Real transaction management with IUnitOfWork pattern is not yet implemented
 * for production use. This is a known limitation that will be addressed in Step 2
 * of the migration from TxRunner to IUnitOfWork.
 *
 * Current status:
 * - Tests: Use FakeUnitOfWork (working)
 * - Production: Use TxRunner in routes (working)
 * - Middleware + Real DB: Not supported (this file)
 *
 * The challenge is that Drizzle's transaction model expects to manage the entire
 * lifecycle within its callback, while the middleware pattern wants to control
 * begin/commit/rollback separately. This requires a more sophisticated implementation
 * that will be part of Step 2.
 */

/**
 * Creates a Unit of Work factory function for middleware
 *
 * This returns a function that can be used with createUnitOfWorkMiddleware
 *
 * @param config - Configuration options
 * @returns Factory function for middleware
 */
export function createUnitOfWorkFactory(config: UnitOfWorkConfig = {}) {
  return async (logger: Logger): Promise<IUnitOfWork> => {
    return createUnitOfWork({ ...config, logger });
  };
}
