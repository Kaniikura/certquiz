import { describe, expect, it } from 'vitest';
import { err, isErr, isOk, map, mapErr, ok, type Result, unwrap, unwrapOr } from './result';

describe('Result type', () => {
  describe('ok', () => {
    it('should create a success result', () => {
      const result = ok('success value');
      expect(result).toEqual({ success: true, data: 'success value' });
    });

    it('should work with different types', () => {
      const numberResult = ok(42);
      expect(numberResult).toEqual({ success: true, data: 42 });

      const objectResult = ok({ id: 1, name: 'test' });
      expect(objectResult).toEqual({ success: true, data: { id: 1, name: 'test' } });

      const arrayResult = ok([1, 2, 3]);
      expect(arrayResult).toEqual({ success: true, data: [1, 2, 3] });
    });
  });

  describe('err', () => {
    it('should create an error result', () => {
      const result = err(new Error('Something went wrong'));
      expect(result.success).toBe(false);
      if (isErr(result)) {
        expect(result.error).toBeInstanceOf(Error);
        expect(result.error.message).toBe('Something went wrong');
      }
    });

    it('should work with custom error types', () => {
      class CustomError extends Error {
        constructor(public code: string) {
          super(`Custom error: ${code}`);
        }
      }

      const result = err(new CustomError('ERR001'));
      expect(result.success).toBe(false);
      if (isErr(result)) {
        expect(result.error).toBeInstanceOf(CustomError);
        expect(result.error.code).toBe('ERR001');
      }
    });

    it('should work with non-Error types', () => {
      const stringError = err('Error message');
      expect(stringError).toEqual({ success: false, error: 'Error message' });

      const objectError = err({ code: 'ERR001', message: 'Failed' });
      expect(objectError).toEqual({ success: false, error: { code: 'ERR001', message: 'Failed' } });
    });
  });

  describe('isOk', () => {
    it('should return true for success results', () => {
      const result = ok('value');
      expect(isOk(result)).toBe(true);
    });

    it('should return false for error results', () => {
      const result = err(new Error('error'));
      expect(isOk(result)).toBe(false);
    });

    it('should narrow type correctly', () => {
      const result: Result<string> = ok('test');
      if (isOk(result)) {
        // TypeScript should know result.data exists here
        expect(result.data).toBe('test');
      }
    });
  });

  describe('isErr', () => {
    it('should return true for error results', () => {
      const result = err(new Error('error'));
      expect(isErr(result)).toBe(true);
    });

    it('should return false for success results', () => {
      const result = ok('value');
      expect(isErr(result)).toBe(false);
    });

    it('should narrow type correctly', () => {
      const result: Result<string> = err(new Error('test error'));
      if (isErr(result)) {
        // TypeScript should know result.error exists here
        expect(result.error.message).toBe('test error');
      }
    });
  });

  describe('map', () => {
    it('should transform success values', () => {
      const result = ok(5);
      const mapped = map(result, (n) => n * 2);
      expect(mapped).toEqual({ success: true, data: 10 });
    });

    it('should pass through error results unchanged', () => {
      const error = new Error('original error');
      const result = err(error);
      const mapped = map(result, (n: number) => n * 2);
      expect(mapped).toEqual({ success: false, error });
    });

    it('should work with type transformations', () => {
      const result = ok('123');
      const mapped = map(result, (s) => parseInt(s, 10));
      expect(mapped).toEqual({ success: true, data: 123 });
    });

    it('should handle complex transformations', () => {
      const result = ok({ id: 1, name: 'Test' });
      const mapped = map(result, (obj) => `${obj.id}: ${obj.name}`);
      expect(mapped).toEqual({ success: true, data: '1: Test' });
    });
  });

  describe('mapErr', () => {
    it('should transform error values', () => {
      const result = err(new Error('original'));
      const mapped = mapErr(result, (e) => new Error(`Wrapped: ${e.message}`));
      expect(mapped.success).toBe(false);
      if (isErr(mapped)) {
        expect(mapped.error.message).toBe('Wrapped: original');
      }
    });

    it('should pass through success results unchanged', () => {
      const result = ok('value');
      const mapped = mapErr(result, () => new Error('should not run'));
      expect(mapped).toEqual({ success: true, data: 'value' });
    });

    it('should work with error type transformations', () => {
      const result = err('string error');
      const mapped = mapErr(result, (s) => new Error(s));
      expect(mapped.success).toBe(false);
      if (isErr(mapped)) {
        expect(mapped.error).toBeInstanceOf(Error);
        expect(mapped.error.message).toBe('string error');
      }
    });
  });

  describe('unwrap', () => {
    it('should return data for success results', () => {
      const result = ok('success value');
      expect(unwrap(result)).toBe('success value');
    });

    it('should throw for error results', () => {
      const error = new Error('test error');
      const result = err(error);
      expect(() => unwrap(result)).toThrow(error);
    });

    it('should throw the exact error', () => {
      class CustomError extends Error {}
      const customError = new CustomError('custom');
      const result = err(customError);

      try {
        unwrap(result);
      } catch (e) {
        expect(e).toBe(customError);
        expect(e).toBeInstanceOf(CustomError);
      }
    });
  });

  describe('unwrapOr', () => {
    it('should return data for success results', () => {
      const result = ok('success value');
      expect(unwrapOr(result, 'default')).toBe('success value');
    });

    it('should return default for error results', () => {
      const result = err(new Error('error'));
      expect(unwrapOr(result, 'default')).toBe('default');
    });

    it('should work with different types', () => {
      const successResult: Result<number> = ok(42);
      const errorResult: Result<number> = err(new Error('error'));

      expect(unwrapOr(successResult, 0)).toBe(42);
      expect(unwrapOr(errorResult, 0)).toBe(0);
    });
  });

  describe('practical usage examples', () => {
    // Simulate a function that might fail
    function divide(a: number, b: number): Result<number> {
      if (b === 0) {
        return err(new Error('Division by zero'));
      }
      return ok(a / b);
    }

    it('should handle division success case', () => {
      const result = divide(10, 2);
      expect(isOk(result)).toBe(true);
      expect(unwrap(result)).toBe(5);
    });

    it('should handle division error case', () => {
      const result = divide(10, 0);
      expect(isErr(result)).toBe(true);
      expect(unwrapOr(result, -1)).toBe(-1);
    });

    it('should chain operations', () => {
      const result = divide(20, 2);
      const doubled = map(result, (n) => n * 2);
      const asString = map(doubled, (n) => `Result: ${n}`);

      expect(unwrap(asString)).toBe('Result: 20');
    });

    it('should handle error transformation', () => {
      const result = divide(10, 0);
      const withContext = mapErr(result, (e) => new Error(`Calculation failed: ${e.message}`));

      if (isErr(withContext)) {
        expect(withContext.error.message).toBe('Calculation failed: Division by zero');
      }
    });
  });

  describe('type safety', () => {
    it('should maintain proper types through transformations', () => {
      // This test mainly ensures TypeScript compilation works correctly
      const stringResult: Result<string> = ok('test');
      const numberResult: Result<number> = map(stringResult, (s) => s.length);
      const booleanResult: Result<boolean> = map(numberResult, (n) => n > 0);

      expect(unwrap(booleanResult)).toBe(true);
    });

    it('should handle union error types', () => {
      type MyError = Error | string | { code: string; message: string };

      const errorResult1: Result<number, MyError> = err(new Error('standard error'));
      const errorResult2: Result<number, MyError> = err('string error');
      const errorResult3: Result<number, MyError> = err({
        code: 'ERR001',
        message: 'object error',
      });

      expect(isErr(errorResult1)).toBe(true);
      expect(isErr(errorResult2)).toBe(true);
      expect(isErr(errorResult3)).toBe(true);
    });
  });
});
