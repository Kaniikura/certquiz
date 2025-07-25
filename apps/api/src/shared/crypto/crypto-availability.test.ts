/**
 * Crypto Availability Tests
 * @fileoverview Tests for crypto availability utilities
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  CryptoUnavailableError,
  ensureCryptoRandomUUID,
  generateSecureSeed,
  isCryptoGetRandomValuesAvailable,
  isCryptoRandomUUIDAvailable,
} from './crypto-availability';

describe('Crypto Availability Utilities', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('isCryptoRandomUUIDAvailable', () => {
    it('should return true when crypto.randomUUID is available', () => {
      expect(isCryptoRandomUUIDAvailable()).toBe(true);
    });

    it('should return false when crypto is undefined', () => {
      vi.stubGlobal('crypto', undefined);

      expect(isCryptoRandomUUIDAvailable()).toBe(false);
    });

    it('should return false when crypto.randomUUID is undefined', () => {
      vi.stubGlobal('crypto', { getRandomValues: vi.fn() });

      expect(isCryptoRandomUUIDAvailable()).toBe(false);
    });
  });

  describe('isCryptoGetRandomValuesAvailable', () => {
    it('should return true when crypto.getRandomValues is available', () => {
      expect(isCryptoGetRandomValuesAvailable()).toBe(true);
    });

    it('should return false when crypto is undefined', () => {
      vi.stubGlobal('crypto', undefined);

      expect(isCryptoGetRandomValuesAvailable()).toBe(false);
    });

    it('should return false when crypto.getRandomValues is undefined', () => {
      vi.stubGlobal('crypto', { randomUUID: vi.fn() });

      expect(isCryptoGetRandomValuesAvailable()).toBe(false);
    });
  });

  describe('ensureCryptoRandomUUID', () => {
    it('should not throw when crypto.randomUUID is available', () => {
      expect(() => ensureCryptoRandomUUID()).not.toThrow();
    });

    it('should throw CryptoUnavailableError when crypto.randomUUID is unavailable', () => {
      vi.stubGlobal('crypto', undefined);

      expect(() => ensureCryptoRandomUUID()).toThrow(CryptoUnavailableError);
      expect(() => ensureCryptoRandomUUID()).toThrow('crypto.randomUUID is not available');
    });
  });

  describe('generateSecureSeed', () => {
    it('should return a number when crypto is available', () => {
      const seed = generateSecureSeed();
      expect(typeof seed).toBe('number');
      expect(seed).toBeGreaterThanOrEqual(0);
      expect(seed).toBeLessThanOrEqual(0xffffffff);
    });

    it('should return a number when crypto is unavailable (fallback)', () => {
      vi.stubGlobal('crypto', undefined);

      const mathRandomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.5);

      const seed = generateSecureSeed();
      expect(typeof seed).toBe('number');
      expect(seed).toBe(Math.floor(0.5 * 0xffffffff));

      mathRandomSpy.mockRestore();
    });

    it('should generate different values on subsequent calls', () => {
      const seed1 = generateSecureSeed();
      const seed2 = generateSecureSeed();
      expect(seed1).not.toBe(seed2);
    });
  });

  describe('CryptoUnavailableError', () => {
    it('should create error with correct message format', () => {
      const error = new CryptoUnavailableError('test.feature', 'Test message');
      expect(error.name).toBe('CryptoUnavailableError');
      expect(error.message).toBe('test.feature is not available. Test message');
    });
  });
});
