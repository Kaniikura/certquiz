/**
 * Error Mapper Tests
 * @fileoverview Unit tests for auth error mapping functionality
 */

import { describe, expect, it } from 'vitest';
import { mapAuthError } from './error-mapper';

describe('mapAuthError', () => {
  it('should map ValidationError to 400 with original message', () => {
    const error = new Error('Invalid email format');
    error.name = 'ValidationError';

    const result = mapAuthError(error);

    expect(result).toEqual({
      status: 400,
      body: { error: 'Invalid email format' },
    });
  });

  it('should map UserNotFoundError to 401 with generic message', () => {
    const error = new Error('User not found');
    error.name = 'UserNotFoundError';

    const result = mapAuthError(error);

    expect(result).toEqual({
      status: 401,
      body: { error: 'Invalid credentials' },
    });
  });

  it('should map InvalidCredentialsError to 401 with generic message', () => {
    const error = new Error('Wrong password');
    error.name = 'InvalidCredentialsError';

    const result = mapAuthError(error);

    expect(result).toEqual({
      status: 401,
      body: { error: 'Invalid credentials' },
    });
  });

  it('should map UserNotActiveError to 403 with account message', () => {
    const error = new Error('User account disabled');
    error.name = 'UserNotActiveError';

    const result = mapAuthError(error);

    expect(result).toEqual({
      status: 403,
      body: { error: 'Account is not active' },
    });
  });

  it('should map unknown errors to 500 with generic message', () => {
    const error = new Error('Database connection failed');
    error.name = 'DatabaseError';

    const result = mapAuthError(error);

    expect(result).toEqual({
      status: 500,
      body: { error: 'Authentication failed' },
    });
  });

  it('should handle errors without name property', () => {
    const error = new Error('Some error');
    // error.name is 'Error' by default

    const result = mapAuthError(error);

    expect(result).toEqual({
      status: 500,
      body: { error: 'Authentication failed' },
    });
  });
});
