/**
 * Runtime detection utilities for test environment
 */

/**
 * Check if we're running under Bun runtime
 */
export function isBun(): boolean {
  return typeof Bun !== 'undefined';
}

/**
 * Check if we're running under Node.js
 */
export function isNode(): boolean {
  return !isBun() && typeof process !== 'undefined' && process.versions?.node !== undefined;
}

/**
 * Get current runtime name
 */
export function getRuntimeName(): 'bun' | 'node' | 'unknown' {
  if (isBun()) return 'bun';
  if (isNode()) return 'node';
  return 'unknown';
}
