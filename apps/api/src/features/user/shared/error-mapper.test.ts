/**
 * User Error Mapper Tests
 * @fileoverview Unit tests for user error mapping functionality
 */

import { ValidationError } from '@api/shared/errors';
import { HttpStatus } from '@api/shared/http-status';
import { describe, expect, it } from 'vitest';
import { mapUserError } from './error-mapper';
import { EmailAlreadyTakenError, UserNotFoundError, UsernameAlreadyTakenError } from './errors';

describe('mapUserError', () => {
  describe('ValidationError mapping', () => {
    it('should map ValidationError instance to 400 with proper response structure', () => {
      const error = new ValidationError('Invalid input data');

      const result = mapUserError(error);

      expect(result).toEqual({
        status: HttpStatus.BAD_REQUEST,
        body: {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid input data',
          },
        },
      });
    });

    it('should properly handle ValidationError instances created anywhere in the codebase', () => {
      // This test verifies that instanceof check works correctly
      // All ValidationError instances in the codebase properly extend ValidationError from shared/errors
      const testCases = [
        new ValidationError('Email is required'),
        new ValidationError('Username too short'),
        new ValidationError('Invalid date format'),
      ];

      testCases.forEach((error) => {
        const result = mapUserError(error);
        expect(result.status).toBe(HttpStatus.BAD_REQUEST);
        expect(result.body.error.code).toBe('VALIDATION_ERROR');
        expect(result.body.error.message).toBe(error.message);
      });
    });

    it('should verify ValidationError inheritance chain', () => {
      const error = new ValidationError('Test error');

      // Verify proper inheritance
      expect(error).toBeInstanceOf(ValidationError);
      expect(error).toBeInstanceOf(Error);
      expect(error.name).toBe('ValidationError');
    });
  });

  describe('Domain-specific error mapping', () => {
    it('should map UserNotFoundError to 404', () => {
      const error = new UserNotFoundError('user123');

      const result = mapUserError(error);

      expect(result).toEqual({
        status: HttpStatus.NOT_FOUND,
        body: {
          success: false,
          error: {
            code: 'USER_NOT_FOUND',
            message: error.message,
          },
        },
      });
    });

    it('should map EmailAlreadyTakenError to 409 with field info', () => {
      const error = new EmailAlreadyTakenError('test@example.com');

      const result = mapUserError(error);

      expect(result).toEqual({
        status: HttpStatus.CONFLICT,
        body: {
          success: false,
          error: {
            code: 'EMAIL_ALREADY_TAKEN',
            message: error.message,
            field: 'email',
          },
        },
      });
    });

    it('should map UsernameAlreadyTakenError to 409 with field info', () => {
      const error = new UsernameAlreadyTakenError('testuser');

      const result = mapUserError(error);

      expect(result).toEqual({
        status: HttpStatus.CONFLICT,
        body: {
          success: false,
          error: {
            code: 'USERNAME_ALREADY_TAKEN',
            message: error.message,
            field: 'username',
          },
        },
      });
    });
  });

  describe('Default error handling', () => {
    it('should map unknown errors to 500 in production', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      const error = new Error('Database connection failed');
      const result = mapUserError(error);

      expect(result).toEqual({
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        body: {
          success: false,
          error: {
            code: 'REPOSITORY_ERROR',
            message: 'Internal server error',
          },
        },
      });

      process.env.NODE_ENV = originalEnv;
    });

    it('should include error details in development', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      const error = new Error('Database connection failed');
      const result = mapUserError(error);

      expect(result.status).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
      expect(result.body.error.code).toBe('REPOSITORY_ERROR');
      expect(result.body.error.message).toBe('Database connection failed');
      expect(result.body.error.details).toBeDefined();
      expect(result.body.error.details).toContain('Error:');

      process.env.NODE_ENV = originalEnv;
    });
  });
});
