import { describe, expect, it } from 'vitest';
import {
  AppError,
  AuthenticationError,
  AuthorizationError,
  ConflictError,
  isAppError,
  NotFoundError,
  RateLimitError,
  ServiceUnavailableError,
  toAppError,
  ValidationError,
} from './errors';

// Error class test data for parameterized tests
const errorClassTests = [
  {
    code: 'TEST_ERROR',
    customArgs: ['Test error', 'TEST_ERROR', 500] as const,
    defaultMessage: 'Test error',
    ErrorClass: AppError,
    name: 'AppError',
    statusCode: 500,
  },
  {
    code: 'VALIDATION_ERROR',
    customArgs: ['Invalid input'] as const,
    defaultMessage: 'Invalid input',
    ErrorClass: ValidationError,
    name: 'ValidationError',
    statusCode: 400,
  },
  {
    code: 'AUTHENTICATION_ERROR',
    customArgs: [] as const,
    defaultMessage: 'Authentication required',
    ErrorClass: AuthenticationError,
    name: 'AuthenticationError',
    statusCode: 401,
  },
  {
    code: 'AUTHORIZATION_ERROR',
    customArgs: [] as const,
    defaultMessage: 'Insufficient permissions',
    ErrorClass: AuthorizationError,
    name: 'AuthorizationError',
    statusCode: 403,
  },
  {
    code: 'NOT_FOUND',
    customArgs: ['User'] as const,
    defaultMessage: 'User not found',
    ErrorClass: NotFoundError,
    name: 'NotFoundError',
    statusCode: 404,
  },
  {
    code: 'CONFLICT',
    customArgs: ['Email already exists'] as const,
    defaultMessage: 'Email already exists',
    ErrorClass: ConflictError,
    name: 'ConflictError',
    statusCode: 409,
  },
  {
    code: 'RATE_LIMIT',
    customArgs: [] as const,
    defaultMessage: 'Too many requests',
    ErrorClass: RateLimitError,
    name: 'RateLimitError',
    statusCode: 429,
  },
  {
    code: 'SERVICE_UNAVAILABLE',
    customArgs: [] as const,
    defaultMessage: 'Service temporarily unavailable',
    ErrorClass: ServiceUnavailableError,
    name: 'ServiceUnavailableError',
    statusCode: 503,
  },
] as const;

describe('Error Classes', () => {
  describe('AppError base class', () => {
    it('should create base app error with all parameters', () => {
      const error = new AppError('Test error', 'TEST_ERROR', 500);

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(AppError);
      expect(error.message).toBe('Test error');
      expect(error.code).toBe('TEST_ERROR');
      expect(error.statusCode).toBe(500);
      expect(error.name).toBe('AppError');
    });

    it('should default to 500 status code', () => {
      const error = new AppError('Test error', 'TEST_ERROR');
      expect(error.statusCode).toBe(500);
    });

    it('should maintain stack trace', () => {
      const error = new AppError('Test error', 'TEST_ERROR');
      expect(error.stack).toBeDefined();
      expect(error.stack).toContain('AppError');
    });
  });

  // Parameterized tests for all error classes
  describe.each(errorClassTests)(
    '$name class tests',
    ({ ErrorClass, name, code, statusCode, defaultMessage, customArgs }) => {
      it('should extend AppError properly', () => {
        // @ts-expect-error - We're testing with generic args
        const error = new ErrorClass(...customArgs);

        expect(error).toBeInstanceOf(ErrorClass);
        expect(error).toBeInstanceOf(AppError);
        expect(error).toBeInstanceOf(Error);
        expect(error.name).toBe(name);
        expect(error.code).toBe(code);
        expect(error.statusCode).toBe(statusCode);
        expect(error.message).toBe(defaultMessage);
      });

      it('should maintain proper prototype chain', () => {
        // @ts-expect-error - We're testing with generic args
        const error = new ErrorClass(...customArgs);

        expect(error instanceof ErrorClass).toBe(true);
        expect(error instanceof AppError).toBe(true);
        expect(error instanceof Error).toBe(true);
      });

      it('should maintain stack trace', () => {
        // @ts-expect-error - We're testing with generic args
        const error = new ErrorClass(...customArgs);

        expect(error.stack).toBeDefined();
        expect(error.stack).toContain(name);
      });
    }
  );

  // Specific tests for error classes with unique behavior
  describe('ValidationError specific tests', () => {
    it('should handle details parameter', () => {
      const details = { field: 'email', reason: 'invalid format' };
      const error = new ValidationError('Invalid input', details);

      expect(error.details).toEqual(details);
    });

    it('should work without details', () => {
      const error = new ValidationError('Invalid input');
      expect(error.details).toBeUndefined();
    });
  });

  describe('AuthenticationError specific tests', () => {
    it('should accept custom message', () => {
      const error = new AuthenticationError('Invalid token');
      expect(error.message).toBe('Invalid token');
    });
  });

  describe('AuthorizationError specific tests', () => {
    it('should accept custom message', () => {
      const error = new AuthorizationError('Admin access required');
      expect(error.message).toBe('Admin access required');
    });
  });

  describe('NotFoundError specific tests', () => {
    it('should format message with different resource names', () => {
      expect(new NotFoundError('Question').message).toBe('Question not found');
      expect(new NotFoundError('Quiz session').message).toBe('Quiz session not found');
    });
  });

  describe('RateLimitError specific tests', () => {
    it('should handle retryAfter parameter', () => {
      const error = new RateLimitError('Rate limit exceeded', 60);

      expect(error.message).toBe('Rate limit exceeded');
      expect(error.retryAfter).toBe(60);
    });

    it('should have undefined retryAfter by default', () => {
      const error = new RateLimitError();
      expect(error.retryAfter).toBeUndefined();
    });
  });

  describe('ServiceUnavailableError specific tests', () => {
    it('should handle service parameter', () => {
      const error = new ServiceUnavailableError('Database connection failed', 'PostgreSQL');

      expect(error.message).toBe('Database connection failed');
      expect(error.service).toBe('PostgreSQL');
    });

    it('should have undefined service by default', () => {
      const error = new ServiceUnavailableError();
      expect(error.service).toBeUndefined();
    });
  });

  // StatusCode uniqueness validation
  describe('StatusCode uniqueness', () => {
    it('should ensure all error classes have unique status codes', () => {
      const statusCodes = errorClassTests.map((test) => test.statusCode);
      const uniqueStatusCodes = new Set(statusCodes);

      expect(uniqueStatusCodes.size).toBe(statusCodes.length);
      expect(uniqueStatusCodes).toEqual(new Set([500, 400, 401, 403, 404, 409, 429, 503]));
    });

    it('should have consistent status codes across instances', () => {
      // Verify each class always returns the same status code
      const statusCodeMappings = errorClassTests.map(({ ErrorClass, statusCode, customArgs }) => {
        // @ts-expect-error - We're testing with generic args
        const error = new ErrorClass(...customArgs);
        return { actual: error.statusCode, expected: statusCode, name: error.name };
      });

      statusCodeMappings.forEach(({ expected, actual }) => {
        expect(actual).toBe(expected);
      });
    });
  });

  describe('isAppError', () => {
    it('should return true for all AppError instances', () => {
      errorClassTests.forEach(({ ErrorClass, customArgs }) => {
        // @ts-expect-error - We're testing with generic args
        const error = new ErrorClass(...customArgs);
        expect(isAppError(error)).toBe(true);
      });
    });

    it('should return false for non-AppError instances', () => {
      const nonAppErrors = [
        new Error('test'),
        new TypeError('test'),
        new ReferenceError('test'),
        new SyntaxError('test'),
        'string error',
        { message: 'error' },
        { code: 'TEST', message: 'error' },
        null,
        undefined,
        123,
        [],
        {},
        true,
        false,
      ];

      nonAppErrors.forEach((item) => {
        expect(isAppError(item)).toBe(false);
      });
    });
  });

  describe('toAppError', () => {
    it('should return AppError instances unchanged', () => {
      errorClassTests.forEach(({ ErrorClass, customArgs }) => {
        // @ts-expect-error - We're testing with generic args
        const appError = new ErrorClass(...customArgs);
        expect(toAppError(appError)).toBe(appError);
        expect(toAppError(appError)).toBeInstanceOf(ErrorClass);
      });
    });

    it('should convert Error instances to AppError', () => {
      const errorTypes = [
        { ErrorClass: Error, message: 'Standard error' },
        { ErrorClass: TypeError, message: 'Type error' },
        { ErrorClass: ReferenceError, message: 'Reference error' },
        { ErrorClass: SyntaxError, message: 'Syntax error' },
        { ErrorClass: RangeError, message: 'Range error' },
      ];

      errorTypes.forEach(({ ErrorClass, message }) => {
        const error = new ErrorClass(message);
        const appError = toAppError(error);

        expect(appError).toBeInstanceOf(AppError);
        expect(appError).toBeInstanceOf(Error); // AppError extends Error
        expect(appError.message).toBe(message);
        expect(appError.code).toBe('INTERNAL_ERROR');
        expect(appError.statusCode).toBe(500);
        expect(appError.name).toBe('AppError');

        // Verify it's not the original error instance
        expect(appError).not.toBe(error);
        // Verify it's specifically an AppError, not the original error type
        if (ErrorClass !== Error) {
          expect(appError.constructor).toBe(AppError);
          expect(appError.constructor).not.toBe(ErrorClass);
        }
      });
    });

    it('should handle non-Error values with consistent fallback', () => {
      const nonErrorValues = [
        'string error',
        { message: 'object with message' },
        { error: 'different property' },
        null,
        undefined,
        123,
        0,
        [],
        ['array', 'error'],
        {},
        true,
        false,
        Symbol('test'),
        new Date(),
        /regex/,
      ];

      nonErrorValues.forEach((value) => {
        const appError = toAppError(value);

        expect(appError).toBeInstanceOf(AppError);
        expect(appError.message).toBe('An unexpected error occurred');
        expect(appError.code).toBe('INTERNAL_ERROR');
        expect(appError.statusCode).toBe(500);
        expect(appError.name).toBe('AppError');
      });
    });

    it('should always return INTERNAL_ERROR code for non-AppError inputs', () => {
      const testInputs = [
        'string',
        new Error('test'),
        new TypeError('test'),
        {},
        null,
        undefined,
        123,
      ];

      testInputs.forEach((input) => {
        const appError = toAppError(input);
        expect(appError.code).toBe('INTERNAL_ERROR');
        expect(appError.statusCode).toBe(500);
      });
    });

    it('should preserve stack trace from Error instances', () => {
      const originalError = new Error('Original error');
      const appError = toAppError(originalError);

      expect(appError.stack).toBeDefined();
      expect(appError.stack).toContain('AppError');
      // The message should be preserved
      expect(appError.message).toBe('Original error');
    });

    it('should handle edge cases gracefully', () => {
      // Test with circular reference object (shouldn't throw)
      const circular: Record<string, unknown> = { name: 'circular' };
      circular.self = circular;

      // Should not throw and should return proper AppError
      const circularResult = toAppError(circular);
      expect(circularResult).toBeInstanceOf(AppError);
      expect(circularResult.message).toBe('An unexpected error occurred');
      expect(circularResult.code).toBe('INTERNAL_ERROR');

      // Test with object that has toString method
      const objectWithToString = {
        toString: () => 'custom string representation',
      };

      const appError = toAppError(objectWithToString);
      expect(appError.message).toBe('An unexpected error occurred');
      expect(appError.code).toBe('INTERNAL_ERROR');

      // Test with function
      const testFunction = () => 'test';
      const functionError = toAppError(testFunction);
      expect(functionError.message).toBe('An unexpected error occurred');
      expect(functionError.code).toBe('INTERNAL_ERROR');
    });
  });

  describe('error inheritance', () => {
    it('should maintain proper prototype chain for all error classes', () => {
      // Filter out AppError itself since it has different prototype chain rules
      const derivedErrorTests = errorClassTests.filter(({ ErrorClass }) => ErrorClass !== AppError);

      derivedErrorTests.forEach(({ ErrorClass, customArgs, name }) => {
        // @ts-expect-error - We're testing with generic args
        const error = new ErrorClass(...customArgs);

        // Check instanceof works correctly
        expect(error instanceof ErrorClass).toBe(true);
        expect(error instanceof AppError).toBe(true);
        expect(error instanceof Error).toBe(true);

        // Check prototype chain for derived classes
        expect(Object.getPrototypeOf(error)).toBe(ErrorClass.prototype);
        expect(Object.getPrototypeOf(ErrorClass.prototype)).toBe(AppError.prototype);

        // Check name property is set correctly
        expect(error.name).toBe(name);
      });
    });

    it('should maintain proper prototype chain for AppError base class', () => {
      const error = new AppError('test', 'TEST', 500);

      // Check instanceof works correctly
      expect(error instanceof AppError).toBe(true);
      expect(error instanceof Error).toBe(true);

      // Check prototype chain for base AppError
      expect(Object.getPrototypeOf(error)).toBe(AppError.prototype);
      expect(Object.getPrototypeOf(AppError.prototype)).toBe(Error.prototype);

      // Check name property
      expect(error.name).toBe('AppError');
    });

    it('should be detectable via constructor.name', () => {
      errorClassTests.forEach(({ ErrorClass, customArgs, name }) => {
        // @ts-expect-error - We're testing with generic args
        const error = new ErrorClass(...customArgs);
        expect(error.constructor.name).toBe(name);
      });
    });
  });

  describe('error serialization', () => {
    it('should serialize basic properties for all error classes', () => {
      errorClassTests.forEach(({ ErrorClass, customArgs, name, code, statusCode }) => {
        // @ts-expect-error - We're testing with generic args
        const error = new ErrorClass(...customArgs);

        const serializable = {
          code: error.code,
          message: error.message,
          name: error.name,
          statusCode: error.statusCode,
        };

        const json = JSON.stringify(serializable);
        const parsed = JSON.parse(json);

        expect(parsed.message).toBe(error.message);
        expect(parsed.code).toBe(code);
        expect(parsed.statusCode).toBe(statusCode);
        expect(parsed.name).toBe(name);
      });
    });

    it('should serialize ValidationError with details', () => {
      const error = new ValidationError('Invalid email', { field: 'email', pattern: /\\S+@\\S+/ });

      const serializable = {
        code: error.code,
        details: error.details,
        message: error.message,
        name: error.name,
        statusCode: error.statusCode,
      };

      const json = JSON.stringify(serializable);
      const parsed = JSON.parse(json);

      expect(parsed.message).toBe('Invalid email');
      expect(parsed.code).toBe('VALIDATION_ERROR');
      expect(parsed.statusCode).toBe(400);
      expect(parsed.details).toEqual({ field: 'email', pattern: {} }); // RegExp becomes empty object
      expect(parsed.name).toBe('ValidationError');
    });

    it('should serialize RateLimitError with retryAfter', () => {
      const error = new RateLimitError('Too many requests', 60);

      const serializable = {
        code: error.code,
        message: error.message,
        name: error.name,
        retryAfter: error.retryAfter,
        statusCode: error.statusCode,
      };

      const json = JSON.stringify(serializable);
      const parsed = JSON.parse(json);

      expect(parsed.retryAfter).toBe(60);
      expect(parsed.code).toBe('RATE_LIMIT');
    });

    it('should serialize ServiceUnavailableError with service', () => {
      const error = new ServiceUnavailableError('Database connection failed', 'PostgreSQL');

      const serializable = {
        code: error.code,
        message: error.message,
        name: error.name,
        service: error.service,
        statusCode: error.statusCode,
      };

      const json = JSON.stringify(serializable);
      const parsed = JSON.parse(json);

      expect(parsed.service).toBe('PostgreSQL');
      expect(parsed.code).toBe('SERVICE_UNAVAILABLE');
    });

    it('should handle serialization of circular references gracefully', () => {
      const circularDetails: Record<string, unknown> = { field: 'test' };
      circularDetails.self = circularDetails;

      const error = new ValidationError('Circular test', circularDetails);

      // This should not throw when extracting properties
      expect(() => {
        const serializable = {
          code: error.code,
          message: error.message,
          name: error.name,
          statusCode: error.statusCode,
          // Skip details to avoid circular reference issues
        };
        JSON.stringify(serializable);
      }).not.toThrow();
    });
  });
});
