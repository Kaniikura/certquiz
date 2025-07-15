/**
 * Error Mapper Tests
 * @fileoverview Unit tests for auth error mapping functionality
 */

import { ValidationError } from '@api/shared/errors';
import { describe, expect, it } from 'vitest';
import {
  InvalidCredentialsError,
  UserNotActiveError,
  UserNotFoundError,
} from '../domain/errors/AuthErrors';
import { mapAuthError } from './error-mapper';

describe('mapAuthError', () => {
  it('should map ValidationError to 400 with original message', () => {
    const error = new ValidationError('Invalid email format');

    const result = mapAuthError(error);

    expect(result).toEqual({
      status: 400,
      body: { error: 'Invalid email format' },
    });
  });

  it('should map UserNotFoundError to 401 with generic message', () => {
    const error = new UserNotFoundError();

    const result = mapAuthError(error);

    expect(result).toEqual({
      status: 401,
      body: { error: 'Invalid credentials' },
    });
  });

  it('should map InvalidCredentialsError to 401 with generic message', () => {
    const error = new InvalidCredentialsError();

    const result = mapAuthError(error);

    expect(result).toEqual({
      status: 401,
      body: { error: 'Invalid credentials' },
    });
  });

  it('should map UserNotActiveError to 403 with account message', () => {
    const error = new UserNotActiveError();

    const result = mapAuthError(error);

    expect(result).toEqual({
      status: 403,
      body: { error: 'Account is not active' },
    });
  });

  it('should map unknown errors to 500 with generic message', () => {
    const error = new Error('Database connection failed');

    const result = mapAuthError(error);

    expect(result).toEqual({
      status: 500,
      body: { error: 'Authentication failed' },
    });
  });

  it('should handle generic errors to 500 with generic message', () => {
    const error = new Error('Some error');

    const result = mapAuthError(error);

    expect(result).toEqual({
      status: 500,
      body: { error: 'Authentication failed' },
    });
  });
});
