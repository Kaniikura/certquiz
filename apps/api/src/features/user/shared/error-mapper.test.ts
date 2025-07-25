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
    it('should map ValidationError instance to 400 with proper response structure', async () => {
      const error = new ValidationError('Invalid input data');

      const result = mapUserError(error);

      expect(result.status).toBe(HttpStatus.BAD_REQUEST);
      expect(result.body).toBeInstanceOf(Response);
      const body = await result.body.json();
      expect(body).toEqual({
        success: false,
        error: {
          message: 'Invalid input data',
          code: 'VALIDATION_ERROR',
        },
      });
    });

    it('should properly handle ValidationError instances created anywhere in the codebase', async () => {
      // This test verifies that instanceof check works correctly
      // All ValidationError instances in the codebase properly extend ValidationError from shared/errors
      const testCases = [
        new ValidationError('Email is required'),
        new ValidationError('Username too short'),
        new ValidationError('Invalid date format'),
      ];

      for (const error of testCases) {
        const result = mapUserError(error);
        expect(result.status).toBe(HttpStatus.BAD_REQUEST);
        expect(result.body).toBeInstanceOf(Response);
        const body = await result.body.json();
        expect(body.success).toBe(false);
        expect(body.error.code).toBe('VALIDATION_ERROR');
        expect(body.error.message).toBe(error.message);
      }
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
    it('should map UserNotFoundError to 404', async () => {
      const error = new UserNotFoundError('user123');

      const result = mapUserError(error);

      expect(result.status).toBe(HttpStatus.NOT_FOUND);
      expect(result.body).toBeInstanceOf(Response);
      const body = await result.body.json();
      expect(body).toEqual({
        success: false,
        error: {
          message: error.message,
          code: 'USER_NOT_FOUND',
        },
      });
    });

    it('should map EmailAlreadyTakenError to 409', async () => {
      const error = new EmailAlreadyTakenError('test@example.com');

      const result = mapUserError(error);

      expect(result.status).toBe(HttpStatus.CONFLICT);
      expect(result.body).toBeInstanceOf(Response);
      const body = await result.body.json();
      expect(body).toEqual({
        success: false,
        error: {
          message: error.message,
          code: 'EMAIL_ALREADY_TAKEN',
          field: 'email',
        },
      });
    });

    it('should map UsernameAlreadyTakenError to 409', async () => {
      const error = new UsernameAlreadyTakenError('testuser');

      const result = mapUserError(error);

      expect(result.status).toBe(HttpStatus.CONFLICT);
      expect(result.body).toBeInstanceOf(Response);
      const body = await result.body.json();
      expect(body).toEqual({
        success: false,
        error: {
          message: error.message,
          code: 'USERNAME_ALREADY_TAKEN',
          field: 'username',
        },
      });
    });
  });

  describe('Default error handling', () => {
    it('should map unknown errors to 500', async () => {
      const error = new Error('Database connection failed');
      const result = mapUserError(error);

      expect(result.status).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
      expect(result.body).toBeInstanceOf(Response);
      const body = await result.body.json();
      expect(body).toEqual({
        success: false,
        error: {
          message: 'Internal server error',
          code: 'INTERNAL_ERROR',
        },
      });
    });

    it('should handle errors with custom names', async () => {
      const error = new Error('Custom error');
      error.name = 'CustomError';
      const result = mapUserError(error);

      expect(result.status).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
      expect(result.body).toBeInstanceOf(Response);
      const body = await result.body.json();
      expect(body).toEqual({
        success: false,
        error: {
          message: 'Internal server error',
          code: 'INTERNAL_ERROR',
        },
      });
    });
  });
});
