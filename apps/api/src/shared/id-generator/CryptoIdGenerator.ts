/**
 * Crypto-based ID Generator Implementation
 * @fileoverview Production implementation using Web Crypto API
 */

import type { IdGenerator } from './IdGenerator';

/**
 * Production ID generator using crypto.randomUUID()
 * Provides cryptographically secure UUID v4 generation
 *
 * Security Features:
 * - Uses Web Crypto API for true randomness
 * - Generates RFC 4122 compliant UUID v4
 * - No predictable patterns or sequence vulnerabilities
 * - Suitable for production use with security requirements
 */
export class CryptoIdGenerator implements IdGenerator {
  /**
   * Generate a cryptographically secure UUID v4
   * @returns A unique UUID v4 string
   * @throws Error if crypto.randomUUID is not available
   */
  generate(): string {
    if (typeof crypto === 'undefined' || typeof crypto.randomUUID !== 'function') {
      throw new Error(
        'crypto.randomUUID is not available. Ensure you are running in a secure context (HTTPS) or Node.js 19+.'
      );
    }

    return crypto.randomUUID();
  }
}
