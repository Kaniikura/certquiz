/**
 * Error utility functions tests
 * @fileoverview Unit tests for shared error handling utilities
 */

import { describe, expect, it } from 'vitest';
import { createValidationErrorResponse, isValidationError } from './error-utils';
import { ValidationError } from './errors';
import { HttpStatus } from './http-status';

describe('Error Utilities', () => {
  describe('isValidationError', () => {
    it('should return true for ValidationError instances', () => {
      const error = new ValidationError('Invalid input');
      expect(isValidationError(error)).toBe(true);
    });

    it('should return false for other error types', () => {
      const genericError = new Error('Generic error');
      expect(isValidationError(genericError)).toBe(false);
    });

    it('should return false for non-error values', () => {
      expect(isValidationError(null)).toBe(false);
      expect(isValidationError(undefined)).toBe(false);
      expect(isValidationError('string')).toBe(false);
      expect(isValidationError(123)).toBe(false);
      expect(isValidationError({})).toBe(false);
    });

    it('should work with ValidationError with details', () => {
      const error = new ValidationError('Validation failed', { field: 'email' });
      expect(isValidationError(error)).toBe(true);
    });
  });

  describe('createValidationErrorResponse', () => {
    it('should create a standardized validation error response', () => {
      const error = new ValidationError('Email is invalid');
      const response = createValidationErrorResponse(error);

      expect(response).toEqual({
        status: HttpStatus.BAD_REQUEST,
        body: {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Email is invalid',
          },
        },
      });
    });

    it('should handle ValidationError with custom details', () => {
      const error = new ValidationError('Field validation failed', {
        field: 'username',
        constraint: 'minLength',
      });
      const response = createValidationErrorResponse(error);

      expect(response.status).toBe(HttpStatus.BAD_REQUEST);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(response.body.error.message).toBe('Field validation failed');
    });

    it('should always return success: false', () => {
      const error = new ValidationError('Any validation error');
      const response = createValidationErrorResponse(error);

      expect(response.body.success).toBe(false);
    });
  });
});
