/**
 * Test utility for testing runtime immutability
 * @fileoverview Helper type to remove readonly modifiers for testing purposes
 */

/**
 * Utility type that removes all readonly modifiers from a type
 * Used for testing runtime immutability without using `any`
 */
export type Mutable<T> = {
  -readonly [K in keyof T]: Mutable<T[K]>;
};
