/**
 * Vitest setup file for integration tests
 *
 * This file runs before integration tests. Unlike unit tests, integration tests
 * preserve environment variables set by globalSetup (testcontainers) and have
 * longer timeouts for real service interactions.
 */

import { beforeAll, vi } from 'vitest';

beforeAll(() => {
  // Set longer timeout for integration tests that interact with real services
  vi.setConfig({ testTimeout: 30_000 });

  // Note: No environment variable stubbing here - we preserve testcontainer URLs
  // set by globalSetup in tests/containers/index.ts
});
