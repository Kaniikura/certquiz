/**
 * Crypto Availability Utilities
 * @fileoverview Shared utilities for checking Web Crypto API availability
 */

/**
 * Error class for crypto unavailability
 */
export class CryptoUnavailableError extends Error {
  constructor(feature: string, message: string) {
    super(`${feature} is not available. ${message}`);
    this.name = 'CryptoUnavailableError';
  }
}

/**
 * Check if crypto.randomUUID is available
 * @returns true if crypto.randomUUID is available
 */
export function isCryptoRandomUUIDAvailable(): boolean {
  return typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function';
}

/**
 * Check if crypto.getRandomValues is available
 * @returns true if crypto.getRandomValues is available
 */
export function isCryptoGetRandomValuesAvailable(): boolean {
  return typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function';
}

/**
 * Ensure crypto.randomUUID is available or throw error
 * @throws CryptoUnavailableError if crypto.randomUUID is not available
 */
export function ensureCryptoRandomUUID(): void {
  if (!isCryptoRandomUUIDAvailable()) {
    throw new CryptoUnavailableError(
      'crypto.randomUUID',
      'Ensure your environment supports the Web Crypto API and crypto.randomUUID.'
    );
  }
}

/**
 * Generate secure random seed using crypto.getRandomValues
 * Falls back to Math.random() if crypto is not available
 * @returns A secure 32-bit unsigned integer seed
 */
export function generateSecureSeed(): number {
  if (isCryptoGetRandomValuesAvailable()) {
    const array = new Uint32Array(1);
    crypto.getRandomValues(array);
    return array[0];
  }

  // Fallback for environments without Web Crypto API
  // This is less secure but better than predictable Math.random()
  return Math.floor(Math.random() * 0xffffffff);
}
