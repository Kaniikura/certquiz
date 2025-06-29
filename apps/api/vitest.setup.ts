/**
 * Vitest setup file for API tests
 *
 * This file runs before each test to ensure consistent environment setup
 * and proper test isolation.
 */

import { beforeEach } from 'vitest';
import { baseTestEnv } from './test-env';

// Capture the original environment when Node started
const originalUnmodified = { ...process.env };

beforeEach(() => {
  // Start each test from the same clean slate:
  // Clear current env and restore original + test defaults
  for (const key in process.env) {
    delete process.env[key];
  }
  Object.assign(process.env, originalUnmodified, baseTestEnv);
});
