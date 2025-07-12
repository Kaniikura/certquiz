/**
 * Test helper functions for Result unwrapping and assertions
 * @fileoverview Utilities to make testing with Result<T,E> pattern more ergonomic
 */

import type { Result } from '@api/shared/result';

/**
 * Unwraps a Result<T,E> or throws an error if the result failed.
 * This is the ONLY place in the codebase where Results are allowed to throw.
 *
 * @param result - The Result to unwrap
 * @param message - Custom error message prefix
 * @returns The unwrapped data if result is successful
 * @throws Error if result failed
 */
export function unwrapOrFail<T, E extends Error>(
  result: Result<T, E>,
  message = 'Unexpected Result.fail in test'
): T {
  if (!result.success) {
    // Preserve original error for debugging while adding context
    throw new Error(`${message}: ${result.error.message}`, {
      cause: result.error,
    });
  }
  return result.data;
}

/**
 * Type guard to check if a Result is successful
 * Useful for TypeScript narrowing in tests
 */
export function isResultOk<T, E>(result: Result<T, E>): result is { success: true; data: T } {
  return result.success;
}

/**
 * Type guard to check if a Result failed
 * Useful for TypeScript narrowing in tests
 */
export function isResultErr<T, E>(result: Result<T, E>): result is { success: false; error: E } {
  return !result.success;
}
