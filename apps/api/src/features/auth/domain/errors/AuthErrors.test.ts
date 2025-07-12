/**
 * Auth domain errors unit tests
 * @fileoverview Test error hierarchy and behavior
 */

import { describe, expect, it } from 'vitest';
import {
  AuthError,
  AuthErrorCode,
  InvalidCredentialsError,
  UserNotActiveError,
  UserNotFoundError,
} from './AuthErrors';

describe('AuthErrors', () => {
  describe('AuthError base class', () => {
    it('should be an Error instance', () => {
      class TestAuthError extends AuthError {
        constructor() {
          super('Test error', AuthErrorCode.INVALID_CREDENTIALS);
        }
      }

      const error = new TestAuthError();
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(AuthError);
      expect(error.name).toBe('TestAuthError');
      expect(error.message).toBe('Test error');
    });
  });

  describe('InvalidCredentialsError', () => {
    it('should have correct message and name', () => {
      const error = new InvalidCredentialsError();
      expect(error).toBeInstanceOf(AuthError);
      expect(error.name).toBe('InvalidCredentialsError');
      expect(error.message).toBe('Invalid credentials provided');
    });
  });

  describe('UserNotActiveError', () => {
    it('should have correct message and name', () => {
      const error = new UserNotActiveError();
      expect(error).toBeInstanceOf(AuthError);
      expect(error.name).toBe('UserNotActiveError');
      expect(error.message).toBe('User account is not active');
    });
  });

  describe('UserNotFoundError', () => {
    it('should have correct message and name', () => {
      const error = new UserNotFoundError();
      expect(error).toBeInstanceOf(AuthError);
      expect(error.name).toBe('UserNotFoundError');
      expect(error.message).toBe('User not found');
    });
  });

  describe('Error inheritance chain', () => {
    it('should maintain proper inheritance chain', () => {
      const errors = [
        new InvalidCredentialsError(),
        new UserNotActiveError(),
        new UserNotFoundError(),
      ];

      for (const error of errors) {
        expect(error).toBeInstanceOf(Error);
        expect(error).toBeInstanceOf(AuthError);
        expect(error.name).toBe(error.constructor.name);
      }
    });

    it('should have proper stack traces', () => {
      const error = new InvalidCredentialsError();
      expect(error.stack).toBeDefined();
      expect(typeof error.stack).toBe('string');
    });
  });
});
