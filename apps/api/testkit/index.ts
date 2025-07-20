/**
 * Testkit barrel export
 * @fileoverview Central export for all test doubles and test utilities
 *
 * This module provides a convenient way to import test doubles from a single location.
 * Following the hybrid approach:
 * - Thin fakes/stubs are collocated with their implementations
 * - Heavy fakes are centralized in tests/fakes/
 */

// Re-export commonly used test utilities
export { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
// Auth test doubles (collocated)
export { FakeAuthProvider } from '../src/infra/auth/AuthProvider.fake';
export { StubAuthProvider } from '../src/infra/auth/AuthProvider.stub';
export { unwrapOrFail } from '../src/test-support';
// Repository fakes (centralized in test-utils/fakes/)
export { FakeQuizRepository } from '../test-utils/fakes/FakeQuizRepository';
export { FakeUnitOfWork } from '../test-utils/fakes/FakeUnitOfWork';
export { FakeUserRepository } from '../test-utils/fakes/FakeUserRepository';
// Test support utilities
export { setupTestDatabase } from '../test-utils/integration-helpers';
