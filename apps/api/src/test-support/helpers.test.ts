/**
 * Test file for test helper functions
 * @fileoverview Tests for Result unwrapping utilities
 */

import { Result } from '@api/shared/result';
import { describe, expect, it } from 'vitest';
import { isResultErr, isResultOk, unwrapOrFail } from './helpers';

describe('Test Support Helpers', () => {
  describe('unwrapOrFail()', () => {
    it('should return data when result is successful', () => {
      const result = Result.ok('test-data');
      const data = unwrapOrFail(result);

      expect(data).toBe('test-data');
    });

    it('should throw when result failed with default message', () => {
      const error = new Error('Domain validation failed');
      const result = Result.fail(error);

      expect(() => {
        unwrapOrFail(result);
      }).toThrow('Unexpected Result.fail in test: Domain validation failed');
    });

    it('should throw with custom message when result failed', () => {
      const error = new Error('Invalid input');
      const result = Result.fail(error);

      expect(() => {
        unwrapOrFail(result, 'Custom test failure');
      }).toThrow('Custom test failure: Invalid input');
    });

    it('should preserve original error as cause', () => {
      const originalError = new Error('Original domain error');
      const result = Result.fail(originalError);

      try {
        unwrapOrFail(result);
      } catch (thrownError) {
        expect(thrownError).toBeInstanceOf(Error);
        expect((thrownError as Error).cause).toBe(originalError);
      }
    });
  });

  describe('isResultOk()', () => {
    it('should return true for successful result', () => {
      const result = Result.ok('data');
      expect(isResultOk(result)).toBe(true);
    });

    it('should return false for failed result', () => {
      const result = Result.fail(new Error('error'));
      expect(isResultOk(result)).toBe(false);
    });

    it('should narrow TypeScript types correctly', () => {
      const result: Result<string, Error> = Result.ok('test');

      if (isResultOk(result)) {
        // TypeScript should know result.data is string
        expect(result.data).toBe('test');
        expect(typeof result.data).toBe('string');
      } else {
        // This branch should not execute
        expect.fail('Result should be ok');
      }
    });
  });

  describe('isResultErr()', () => {
    it('should return false for successful result', () => {
      const result = Result.ok('data');
      expect(isResultErr(result)).toBe(false);
    });

    it('should return true for failed result', () => {
      const result = Result.fail(new Error('error'));
      expect(isResultErr(result)).toBe(true);
    });

    it('should narrow TypeScript types correctly', () => {
      const result: Result<string, Error> = Result.fail(new Error('test error'));

      if (isResultErr(result)) {
        // TypeScript should know result.error is Error
        expect(result.error.message).toBe('test error');
        expect(result.error).toBeInstanceOf(Error);
      } else {
        // This branch should not execute
        expect.fail('Result should be error');
      }
    });
  });

  describe('Integration with Domain Objects', () => {
    it('should work seamlessly with domain factory methods', () => {
      // Simulate a domain factory that returns Result<T, E>
      const createValidObject = () => Result.ok({ id: '123', name: 'test' });
      const createInvalidObject = () => Result.fail(new Error('Validation failed'));

      // Should unwrap successfully
      const validObject = unwrapOrFail(createValidObject());
      expect(validObject.id).toBe('123');
      expect(validObject.name).toBe('test');

      // Should throw on invalid
      expect(() => {
        unwrapOrFail(createInvalidObject());
      }).toThrow('Validation failed');
    });
  });
});
