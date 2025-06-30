/**
 * Vitest setup file for unit tests
 *
 * This file runs before each unit test to ensure consistent environment setup
 * and proper test isolation using Vitest's built-in env stubbing.
 */

import { beforeEach, vi } from 'vitest';
import { baseTestEnv } from '../../test-env';

beforeEach(() => {
  // Reset all environment variable stubs from previous tests
  vi.unstubAllEnvs();

  // Apply base test environment using safe stubbing
  for (const [key, value] of Object.entries(baseTestEnv)) {
    vi.stubEnv(key, value);
  }
});
