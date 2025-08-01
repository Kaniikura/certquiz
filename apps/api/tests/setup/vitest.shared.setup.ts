/**
 * Shared Vitest setup file
 *
 * This file contains setup logic that is common to both unit and integration tests.
 * Currently minimal, but provides a place for shared configurations as the project grows.
 */

// Ensure NODE_ENV is set to 'test' for all tests
process.env.NODE_ENV = 'test';

// Global crypto polyfill for test environment
// This ensures crypto.randomUUID() is available in Node.js test environments
import { webcrypto } from 'node:crypto';

// Polyfill global crypto if not available
if (typeof globalThis.crypto === 'undefined') {
  // @ts-expect-error - Node's webcrypto implements the Web Crypto API
  globalThis.crypto = webcrypto;
}
