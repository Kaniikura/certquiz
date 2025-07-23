/**
 * Testing Domain - Domain-specific test doubles and utilities
 *
 * This package consolidates all domain-specific test utilities including
 * fakes, stubs, test builders, and integration helpers that understand
 * the business domain and bounded contexts.
 *
 * Organization:
 * - Domain-specific test doubles (fakes, stubs, builders)
 * - Integration test helpers that orchestrate infrastructure
 * - Test utilities that understand business rules and workflows
 *
 * @see https://docs.anthropic.com/en/docs/claude-code
 */

// Auth test doubles (collocated with implementations)
export { FakeAuthProvider } from '@api/infra/auth/AuthProvider.fake';
export { StubAuthProvider } from '@api/infra/auth/AuthProvider.stub';
// Domain test support utilities
export { unwrapOrFail } from '@api/test-support';
// Repository fakes - centralized domain test doubles
export {
  FakeAuthUserRepository,
  FakeQuestionRepository,
  FakeQuizRepository,
  FakeUnitOfWork,
  FakeUserRepository,
} from './fakes';

// Integration test helpers - orchestrates both infra and domain layers
export { setupTestDatabase } from './integration-helpers';
