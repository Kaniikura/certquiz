/**
 * Testing Utilities - Convenience barrel export
 *
 * This is a convenience barrel that re-exports both infrastructure and domain
 * testing utilities for quick access. For better organization and explicit
 * imports, prefer importing directly from:
 *
 * - @api/testing/infra - for technical infrastructure utilities
 * - @api/testing/domain - for domain-specific test doubles
 *
 * @see https://docs.anthropic.com/en/docs/claude-code
 */

// Re-export ambient pattern helpers
export {
  createTestContext,
  createTestDependencies,
  getTestUnitOfWork,
  type RepositorySet,
  type TestDependencies,
} from './ambient-helpers';
// Re-export domain utilities
export * from './domain';
// Re-export infrastructure utilities
export * from './infra';
