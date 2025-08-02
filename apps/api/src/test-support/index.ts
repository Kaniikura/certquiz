/**
 * Shared test utilities
 * @fileoverview Central export for test support utilities
 */

// Export all categories
export { aQuestionReference, aQuizSession } from './builders';
export {
  FakePremiumAccessService,
  InMemoryAuthUserRepository,
  InMemoryDatabaseContext,
  InMemoryQuestionRepository,
  InMemoryQuizRepository,
  InMemoryUnitOfWork,
  InMemoryUserRepository,
} from './fakes';
// fixtures exports nothing meaningful (empty export)
// Re-export helpers
export { unwrapOrFail } from './helpers';
export {
  createExpiredJwtBuilder,
  createJwtBuilder,
  DEFAULT_JWT_CLAIMS,
  jwtVerifySuccess,
  resetJwtVerifierCache,
} from './mocks';
export type { Mutable } from './types';
export { createNoopLogger, TestClock, testIds } from './utils';
