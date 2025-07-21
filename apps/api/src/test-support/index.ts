/**
 * Shared test utilities
 * @fileoverview Central export for test support utilities
 */

// Re-export commonly used types for convenience
export type { Clock } from '@api/shared/clock';
export { isResultErr, isResultOk, unwrapOrFail } from './helpers';
export { testIds } from './id-generators';
// JWT token creation utilities for tests
export {
  createExpiredJwtBuilder,
  createJwtBuilder,
  DEFAULT_JWT_CLAIMS,
  DEFAULT_JWT_CONFIG,
} from './jose-mock-helpers';
export { TestClock } from './TestClock';
// Test logger utilities
export { createNoopLogger, createSpyLogger, createTestLogger } from './test-logger';
export type { Mutable } from './types/Mutable';
