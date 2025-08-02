/**
 * Test logger utilities
 * @fileoverview Logger utilities for testing
 */

import type { LoggerPort } from '@api/shared/logger';
import { NoopLogger } from '@api/shared/logger';

/**
 * Creates a no-op logger for domain tests
 *
 * This is the preferred logger for domain unit tests that use LoggerPort.
 *
 * @returns A no-op logger instance
 */
export function createNoopLogger(): LoggerPort {
  return new NoopLogger();
}
