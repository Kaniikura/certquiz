/**
 * Question Error Mapper Tests
 * @fileoverview Unit tests for question error mapping functionality
 */

import { ValidationError } from '@api/shared/errors';
import { HttpStatus } from '@api/shared/http-status';
import { describe, expect, it } from 'vitest';
import { mapQuestionError } from './error-mapper';
import {
  InvalidQuestionDataError,
  QuestionAccessDeniedError,
  QuestionNotFoundError,
  QuestionRepositoryConfigurationError,
  QuestionRepositoryError,
  QuestionVersionConflictError,
} from './errors';

describe('mapQuestionError', () => {
  describe('ValidationError mapping', () => {
    it('should map ValidationError instance to 400 with proper response structure', () => {
      const error = new ValidationError('Invalid question data');

      const result = mapQuestionError(error);

      expect(result).toEqual({
        status: HttpStatus.BAD_REQUEST,
        body: {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid question data',
          },
        },
      });
    });

    it('should properly handle ValidationError instances created anywhere in the codebase', () => {
      // This test verifies that instanceof check works correctly
      // All ValidationError instances in the codebase properly extend ValidationError from shared/errors
      const testCases = [
        new ValidationError('Question text cannot be empty'),
        new ValidationError('At least one exam type is required'),
        new ValidationError('Questions must have at least 2 options'),
      ];

      testCases.forEach((error) => {
        const result = mapQuestionError(error);
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
    it('should map InvalidQuestionDataError to 400', () => {
      const error = new InvalidQuestionDataError('Invalid question format');

      const result = mapQuestionError(error);

      expect(result).toEqual({
        status: HttpStatus.BAD_REQUEST,
        body: {
          success: false,
          error: {
            code: 'INVALID_QUESTION_DATA',
            message: error.message,
          },
        },
      });
    });

    it('should map QuestionAccessDeniedError to 403', () => {
      const error = new QuestionAccessDeniedError(
        'question123',
        'Premium content requires authentication'
      );

      const result = mapQuestionError(error);

      expect(result).toEqual({
        status: HttpStatus.FORBIDDEN,
        body: {
          success: false,
          error: {
            code: 'QUESTION_ACCESS_DENIED',
            message: error.message,
          },
        },
      });
    });

    it('should map QuestionNotFoundError to 404', () => {
      const error = new QuestionNotFoundError('question123');

      const result = mapQuestionError(error);

      expect(result).toEqual({
        status: HttpStatus.NOT_FOUND,
        body: {
          success: false,
          error: {
            code: 'QUESTION_NOT_FOUND',
            message: error.message,
          },
        },
      });
    });

    it('should map QuestionVersionConflictError to 409', () => {
      const error = new QuestionVersionConflictError('question123', 2, 3);

      const result = mapQuestionError(error);

      expect(result).toEqual({
        status: HttpStatus.CONFLICT,
        body: {
          success: false,
          error: {
            code: 'QUESTION_VERSION_CONFLICT',
            message: error.message,
          },
        },
      });
    });

    it('should map QuestionRepositoryConfigurationError to 500 without exposing details', () => {
      const error = new QuestionRepositoryConfigurationError('Database connection string missing');

      const result = mapQuestionError(error);

      expect(result).toEqual({
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        body: {
          success: false,
          error: {
            code: 'REPOSITORY_CONFIG_ERROR',
            message: 'Repository configuration error',
          },
        },
      });
      // Verify internal details are not exposed
      expect(result.body.error.message).not.toContain('Database connection');
    });

    it('should map QuestionRepositoryError to 500 without exposing details', () => {
      const error = new QuestionRepositoryError('findById', 'connection timeout');

      const result = mapQuestionError(error);

      expect(result).toEqual({
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        body: {
          success: false,
          error: {
            code: 'REPOSITORY_ERROR',
            message: 'Database operation failed',
          },
        },
      });
      // Verify internal details are not exposed
      expect(result.body.error.message).not.toContain('findById');
      expect(result.body.error.message).not.toContain('connection timeout');
    });
  });

  describe('Default error handling', () => {
    it('should map unknown errors to 500 in production', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      const error = new Error('Database connection failed');
      const result = mapQuestionError(error);

      expect(result).toEqual({
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        body: {
          success: false,
          error: {
            code: 'INTERNAL_ERROR',
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
      const result = mapQuestionError(error);

      expect(result.status).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
      expect(result.body.error.code).toBe('INTERNAL_ERROR');
      expect(result.body.error.message).toBe('Database connection failed');
      expect(result.body.error.details).toBeDefined();
      expect(result.body.error.details).toContain('Error:');

      process.env.NODE_ENV = originalEnv;
    });
  });

  describe('Structured logging integration', () => {
    it('should still handle repository configuration errors correctly with logging', () => {
      const error = new QuestionRepositoryConfigurationError(
        'Database connection string is invalid'
      );

      const result = mapQuestionError(error);

      // Verify user response doesn't expose internal details (main security requirement)
      expect(result.status).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
      expect(result.body.error.code).toBe('REPOSITORY_CONFIG_ERROR');
      expect(result.body.error.message).toBe('Repository configuration error');
      expect(result.body.error.message).not.toContain('Database connection string');
      expect(result.body.error.message).not.toContain('invalid');
    });

    it('should still handle repository errors correctly with logging', () => {
      const error = new QuestionRepositoryError('findById', 'Connection timeout after 30s');

      const result = mapQuestionError(error);

      // Verify user response doesn't expose internal details (main security requirement)
      expect(result.status).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
      expect(result.body.error.code).toBe('REPOSITORY_ERROR');
      expect(result.body.error.message).toBe('Database operation failed');
      expect(result.body.error.message).not.toContain('findById');
      expect(result.body.error.message).not.toContain('Connection timeout');
    });

    it('should still handle unexpected errors correctly with logging', () => {
      const error = new TypeError('Cannot read property "id" of undefined');
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      const result = mapQuestionError(error);

      // Verify user response in production mode
      expect(result.status).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
      expect(result.body.error.code).toBe('INTERNAL_ERROR');
      expect(result.body.error.message).toBe('Internal server error');
      expect(result.body.error.message).not.toContain('Cannot read property');

      process.env.NODE_ENV = originalEnv;
    });
  });
});
