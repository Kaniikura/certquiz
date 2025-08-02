import { ensureCryptoRandomUUID } from '@api/shared/crypto/crypto-availability';
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
   * @throws CryptoUnavailableError if crypto.randomUUID is not available
   */
  generate(): string {
    ensureCryptoRandomUUID();
    return crypto.randomUUID();
  }
}
