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

describe('Error Classes', () => {
  describe('AppError', () => {
    it('should create base app error', () => {
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

  describe('ValidationError', () => {
    it('should create validation error with details', () => {
      const details = { field: 'email', reason: 'invalid format' };
      const error = new ValidationError('Invalid input', details);

      expect(error).toBeInstanceOf(ValidationError);
      expect(error).toBeInstanceOf(AppError);
      expect(error.message).toBe('Invalid input');
      expect(error.code).toBe('VALIDATION_ERROR');
      expect(error.statusCode).toBe(400);
      expect(error.details).toEqual(details);
      expect(error.name).toBe('ValidationError');
    });

    it('should work without details', () => {
      const error = new ValidationError('Invalid input');

      expect(error.details).toBeUndefined();
      expect(error.message).toBe('Invalid input');
      expect(error.statusCode).toBe(400);
    });
  });

  describe('AuthenticationError', () => {
    it('should create authentication error with default message', () => {
      const error = new AuthenticationError();

      expect(error).toBeInstanceOf(AuthenticationError);
      expect(error).toBeInstanceOf(AppError);
      expect(error.message).toBe('Authentication required');
      expect(error.code).toBe('AUTHENTICATION_ERROR');
      expect(error.statusCode).toBe(401);
      expect(error.name).toBe('AuthenticationError');
    });

    it('should accept custom message', () => {
      const error = new AuthenticationError('Invalid token');
      expect(error.message).toBe('Invalid token');
    });
  });

  describe('AuthorizationError', () => {
    it('should create authorization error with default message', () => {
      const error = new AuthorizationError();

      expect(error).toBeInstanceOf(AuthorizationError);
      expect(error).toBeInstanceOf(AppError);
      expect(error.message).toBe('Insufficient permissions');
      expect(error.code).toBe('AUTHORIZATION_ERROR');
      expect(error.statusCode).toBe(403);
      expect(error.name).toBe('AuthorizationError');
    });

    it('should accept custom message', () => {
      const error = new AuthorizationError('Admin access required');
      expect(error.message).toBe('Admin access required');
    });
  });

  describe('NotFoundError', () => {
    it('should create not found error with resource name', () => {
      const error = new NotFoundError('User');

      expect(error).toBeInstanceOf(NotFoundError);
      expect(error).toBeInstanceOf(AppError);
      expect(error.message).toBe('User not found');
      expect(error.code).toBe('NOT_FOUND');
      expect(error.statusCode).toBe(404);
      expect(error.name).toBe('NotFoundError');
    });

    it('should work with different resource names', () => {
      expect(new NotFoundError('Question').message).toBe('Question not found');
      expect(new NotFoundError('Quiz session').message).toBe('Quiz session not found');
    });
  });

  describe('ConflictError', () => {
    it('should create conflict error', () => {
      const error = new ConflictError('Email already exists');

      expect(error).toBeInstanceOf(ConflictError);
      expect(error).toBeInstanceOf(AppError);
      expect(error.message).toBe('Email already exists');
      expect(error.code).toBe('CONFLICT');
      expect(error.statusCode).toBe(409);
      expect(error.name).toBe('ConflictError');
    });
  });

  describe('RateLimitError', () => {
    it('should create rate limit error with default message', () => {
      const error = new RateLimitError();

      expect(error).toBeInstanceOf(RateLimitError);
      expect(error).toBeInstanceOf(AppError);
      expect(error.message).toBe('Too many requests');
      expect(error.code).toBe('RATE_LIMIT');
      expect(error.statusCode).toBe(429);
      expect(error.name).toBe('RateLimitError');
      expect(error.retryAfter).toBeUndefined();
    });

    it('should accept custom message and retry after', () => {
      const error = new RateLimitError('Rate limit exceeded', 60);

      expect(error.message).toBe('Rate limit exceeded');
      expect(error.retryAfter).toBe(60);
    });
  });

  describe('ServiceUnavailableError', () => {
    it('should create service unavailable error with default message', () => {
      const error = new ServiceUnavailableError();

      expect(error).toBeInstanceOf(ServiceUnavailableError);
      expect(error).toBeInstanceOf(AppError);
      expect(error.message).toBe('Service temporarily unavailable');
      expect(error.code).toBe('SERVICE_UNAVAILABLE');
      expect(error.statusCode).toBe(503);
      expect(error.name).toBe('ServiceUnavailableError');
      expect(error.service).toBeUndefined();
    });

    it('should accept custom message and service name', () => {
      const error = new ServiceUnavailableError('Database connection failed', 'PostgreSQL');

      expect(error.message).toBe('Database connection failed');
      expect(error.service).toBe('PostgreSQL');
    });
  });

  describe('isAppError', () => {
    it('should return true for AppError instances', () => {
      expect(isAppError(new AppError('test', 'TEST'))).toBe(true);
      expect(isAppError(new ValidationError('test'))).toBe(true);
      expect(isAppError(new AuthenticationError())).toBe(true);
      expect(isAppError(new AuthorizationError())).toBe(true);
      expect(isAppError(new NotFoundError('test'))).toBe(true);
      expect(isAppError(new ConflictError('test'))).toBe(true);
      expect(isAppError(new RateLimitError())).toBe(true);
      expect(isAppError(new ServiceUnavailableError())).toBe(true);
    });

    it('should return false for non-AppError instances', () => {
      expect(isAppError(new Error('test'))).toBe(false);
      expect(isAppError(new TypeError('test'))).toBe(false);
      expect(isAppError('string error')).toBe(false);
      expect(isAppError({ message: 'error' })).toBe(false);
      expect(isAppError(null)).toBe(false);
      expect(isAppError(undefined)).toBe(false);
    });
  });

  describe('toAppError', () => {
    it('should return AppError instances unchanged', () => {
      const appError = new ValidationError('test');
      expect(toAppError(appError)).toBe(appError);
    });

    it('should convert standard Error to AppError', () => {
      const error = new Error('Standard error');
      const appError = toAppError(error);

      expect(appError).toBeInstanceOf(AppError);
      expect(appError.message).toBe('Standard error');
      expect(appError.code).toBe('INTERNAL_ERROR');
      expect(appError.statusCode).toBe(500);
    });

    it('should convert TypeError to AppError', () => {
      const error = new TypeError('Type error');
      const appError = toAppError(error);

      expect(appError).toBeInstanceOf(AppError);
      expect(appError.message).toBe('Type error');
      expect(appError.code).toBe('INTERNAL_ERROR');
      expect(appError.statusCode).toBe(500);
    });

    it('should handle non-Error values', () => {
      expect(toAppError('string error').message).toBe('An unexpected error occurred');
      expect(toAppError({ message: 'object' }).message).toBe('An unexpected error occurred');
      expect(toAppError(null).message).toBe('An unexpected error occurred');
      expect(toAppError(undefined).message).toBe('An unexpected error occurred');
      expect(toAppError(123).message).toBe('An unexpected error occurred');
    });

    it('should always return INTERNAL_ERROR code for unknown errors', () => {
      expect(toAppError('string').code).toBe('INTERNAL_ERROR');
      expect(toAppError(new Error('test')).code).toBe('INTERNAL_ERROR');
      expect(toAppError({}).code).toBe('INTERNAL_ERROR');
    });
  });

  describe('error inheritance', () => {
    it('should maintain proper prototype chain', () => {
      const validationError = new ValidationError('test');

      // Check instanceof works correctly
      expect(validationError instanceof ValidationError).toBe(true);
      expect(validationError instanceof AppError).toBe(true);
      expect(validationError instanceof Error).toBe(true);

      // Check prototype chain
      expect(Object.getPrototypeOf(validationError)).toBe(ValidationError.prototype);
      expect(Object.getPrototypeOf(ValidationError.prototype)).toBe(AppError.prototype);
      expect(Object.getPrototypeOf(AppError.prototype)).toBe(Error.prototype);
    });
  });

  describe('error serialization', () => {
    it('should serialize to JSON correctly', () => {
      const error = new ValidationError('Invalid email', { field: 'email' });
      // Error objects don't serialize well by default, need to extract properties
      const serializable = {
        message: error.message,
        code: error.code,
        statusCode: error.statusCode,
        details: error.details,
        name: error.name,
      };
      const json = JSON.stringify(serializable);
      const parsed = JSON.parse(json);

      expect(parsed.message).toBe('Invalid email');
      expect(parsed.code).toBe('VALIDATION_ERROR');
      expect(parsed.statusCode).toBe(400);
      expect(parsed.details).toEqual({ field: 'email' });
    });

    it('should include custom properties in serialization', () => {
      const error = new RateLimitError('Too many requests', 60);
      // Error objects don't serialize well by default, need to extract properties
      const serializable = {
        message: error.message,
        code: error.code,
        statusCode: error.statusCode,
        retryAfter: error.retryAfter,
        name: error.name,
      };
      const json = JSON.stringify(serializable);
      const parsed = JSON.parse(json);

      expect(parsed.retryAfter).toBe(60);
    });
  });
});
