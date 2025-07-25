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
  it('should map ValidationError to 400 with original message', async () => {
    const error = new ValidationError('Invalid email format');

    const result = mapAuthError(error);

    expect(result.status).toBe(400);
    expect(result.body).toBeInstanceOf(Response);
    const body = await result.body.json();
    expect(body).toEqual({
      success: false,
      error: {
        message: 'Invalid email format',
        code: 'VALIDATION_ERROR',
      },
    });
  });

  it('should map UserNotFoundError to 401 with generic message', async () => {
    const error = new UserNotFoundError();

    const result = mapAuthError(error);

    expect(result.status).toBe(401);
    expect(result.body).toBeInstanceOf(Response);
    const body = await result.body.json();
    expect(body).toEqual({
      success: false,
      error: {
        message: 'Invalid credentials',
        code: 'INVALID_CREDENTIALS',
      },
    });
  });

  it('should map InvalidCredentialsError to 401 with generic message', async () => {
    const error = new InvalidCredentialsError();

    const result = mapAuthError(error);

    expect(result.status).toBe(401);
    expect(result.body).toBeInstanceOf(Response);
    const body = await result.body.json();
    expect(body).toEqual({
      success: false,
      error: {
        message: 'Invalid credentials',
        code: 'INVALID_CREDENTIALS',
      },
    });
  });

  it('should map UserNotActiveError to 403 with account message', async () => {
    const error = new UserNotActiveError();

    const result = mapAuthError(error);

    expect(result.status).toBe(403);
    expect(result.body).toBeInstanceOf(Response);
    const body = await result.body.json();
    expect(body).toEqual({
      success: false,
      error: {
        message: 'Account is not active',
        code: 'ACCOUNT_NOT_ACTIVE',
      },
    });
  });

  it('should map unknown errors to 500 with generic message', async () => {
    const error = new Error('Database connection failed');

    const result = mapAuthError(error);

    expect(result.status).toBe(500);
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

  it('should handle generic errors to 500 with generic message', async () => {
    const error = new Error('Some error');

    const result = mapAuthError(error);

    expect(result.status).toBe(500);
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
