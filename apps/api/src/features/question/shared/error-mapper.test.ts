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
    it('should map ValidationError instance to 400 with proper response structure', async () => {
      const error = new ValidationError('Invalid question data');

      const result = mapQuestionError(error);

      expect(result.status).toBe(HttpStatus.BAD_REQUEST);
      expect(result.body).toBeInstanceOf(Response);
      const body = await result.body.json();
      expect(body).toEqual({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid question data',
        },
      });
    });

    it('should properly handle ValidationError instances created anywhere in the codebase', async () => {
      // This test verifies that instanceof check works correctly
      // All ValidationError instances in the codebase properly extend ValidationError from shared/errors
      const testCases = [
        new ValidationError('Question text cannot be empty'),
        new ValidationError('At least one exam type is required'),
        new ValidationError('Questions must have at least 2 options'),
      ];

      for (const error of testCases) {
        const result = mapQuestionError(error);
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
    it('should map InvalidQuestionDataError to 400', async () => {
      const error = new InvalidQuestionDataError('Invalid question format');

      const result = mapQuestionError(error);

      expect(result.status).toBe(HttpStatus.BAD_REQUEST);
      expect(result.body).toBeInstanceOf(Response);
      const body = await result.body.json();
      expect(body).toEqual({
        success: false,
        error: {
          code: 'INVALID_QUESTION_DATA',
          message: error.message,
        },
      });
    });

    it('should map QuestionAccessDeniedError to 403', async () => {
      const error = new QuestionAccessDeniedError(
        'question123',
        'Premium content requires authentication'
      );

      const result = mapQuestionError(error);

      expect(result.status).toBe(HttpStatus.FORBIDDEN);
      expect(result.body).toBeInstanceOf(Response);
      const body = await result.body.json();
      expect(body).toEqual({
        success: false,
        error: {
          code: 'QUESTION_ACCESS_DENIED',
          message: error.message,
        },
      });
    });

    it('should map QuestionNotFoundError to 404', async () => {
      const error = new QuestionNotFoundError('question123');

      const result = mapQuestionError(error);

      expect(result.status).toBe(HttpStatus.NOT_FOUND);
      expect(result.body).toBeInstanceOf(Response);
      const body = await result.body.json();
      expect(body).toEqual({
        success: false,
        error: {
          code: 'QUESTION_NOT_FOUND',
          message: error.message,
        },
      });
    });

    it('should map QuestionVersionConflictError to 409', async () => {
      const error = new QuestionVersionConflictError('question123', 2, 3);

      const result = mapQuestionError(error);

      expect(result.status).toBe(HttpStatus.CONFLICT);
      expect(result.body).toBeInstanceOf(Response);
      const body = await result.body.json();
      expect(body).toEqual({
        success: false,
        error: {
          code: 'QUESTION_VERSION_CONFLICT',
          message: error.message,
        },
      });
    });

    it('should map QuestionRepositoryConfigurationError to 500 without exposing details', async () => {
      const error = new QuestionRepositoryConfigurationError('Database connection string missing');

      const result = mapQuestionError(error);

      expect(result.status).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
      expect(result.body).toBeInstanceOf(Response);
      const body = await result.body.json();
      expect(body).toEqual({
        success: false,
        error: {
          code: 'REPOSITORY_CONFIG_ERROR',
          message: 'Repository configuration error',
        },
      });
      // Verify internal details are not exposed
      expect(body.error.message).not.toContain('Database connection');
    });

    it('should map QuestionRepositoryError to 500 without exposing details', async () => {
      const error = new QuestionRepositoryError('findById', 'connection timeout');

      const result = mapQuestionError(error);

      expect(result.status).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
      expect(result.body).toBeInstanceOf(Response);
      const body = await result.body.json();
      expect(body).toEqual({
        success: false,
        error: {
          code: 'REPOSITORY_ERROR',
          message: 'Database operation failed',
        },
      });
      // Verify internal details are not exposed
      expect(body.error.message).not.toContain('findById');
      expect(body.error.message).not.toContain('connection timeout');
    });
  });

  describe('Default error handling', () => {
    it('should map unknown errors to 500', async () => {
      const error = new Error('Database connection failed');
      const result = mapQuestionError(error);

      expect(result.status).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
      expect(result.body).toBeInstanceOf(Response);
      const body = await result.body.json();
      expect(body).toEqual({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Internal server error',
        },
      });
    });

    it('should handle errors with custom names', async () => {
      const error = new Error('Custom error');
      error.name = 'CustomError';
      const result = mapQuestionError(error);

      expect(result.status).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
      expect(result.body).toBeInstanceOf(Response);
      const body = await result.body.json();
      expect(body).toEqual({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Internal server error',
        },
      });
    });
  });

  describe('Structured logging integration', () => {
    it('should still handle repository configuration errors correctly', async () => {
      const error = new QuestionRepositoryConfigurationError(
        'Database connection string is invalid'
      );

      const result = mapQuestionError(error);

      // Verify user response doesn't expose internal details (main security requirement)
      expect(result.status).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
      expect(result.body).toBeInstanceOf(Response);
      const body = await result.body.json();
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('REPOSITORY_CONFIG_ERROR');
      expect(body.error.message).toBe('Repository configuration error');
      expect(body.error.message).not.toContain('Database connection string');
      expect(body.error.message).not.toContain('invalid');
    });

    it('should still handle repository errors correctly', async () => {
      const error = new QuestionRepositoryError('findById', 'Connection timeout after 30s');

      const result = mapQuestionError(error);

      // Verify user response doesn't expose internal details (main security requirement)
      expect(result.status).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
      expect(result.body).toBeInstanceOf(Response);
      const body = await result.body.json();
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('REPOSITORY_ERROR');
      expect(body.error.message).toBe('Database operation failed');
      expect(body.error.message).not.toContain('findById');
      expect(body.error.message).not.toContain('Connection timeout');
    });

    it('should still handle unexpected errors correctly', async () => {
      const error = new TypeError('Cannot read property "id" of undefined');

      const result = mapQuestionError(error);

      // Verify user response in production mode
      expect(result.status).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
      expect(result.body).toBeInstanceOf(Response);
      const body = await result.body.json();
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('INTERNAL_ERROR');
      expect(body.error.message).toBe('Internal server error');
      expect(body.error.message).not.toContain('Cannot read property');
    });
  });
});
