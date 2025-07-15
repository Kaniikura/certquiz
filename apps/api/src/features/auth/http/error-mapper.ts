/**
 * Auth Error Mapper
 * @fileoverview Maps domain errors to HTTP status codes and response bodies
 */

import { ValidationError } from '@api/shared/errors';
import {
  InvalidCredentialsError,
  UserNotActiveError,
  UserNotFoundError,
} from '../domain/errors/AuthErrors';

type ErrorResponse = {
  status: 400 | 401 | 403 | 500;
  body: { error: string };
};

/**
 * Maps authentication domain errors to HTTP responses
 * @param error - Domain error to map
 * @returns HTTP status code and response body
 */
export function mapAuthError(error: Error): ErrorResponse {
  if (error instanceof ValidationError) {
    return {
      status: 400,
      body: { error: error.message },
    };
  }

  if (error instanceof UserNotFoundError || error instanceof InvalidCredentialsError) {
    return {
      status: 401,
      body: { error: 'Invalid credentials' },
    };
  }

  if (error instanceof UserNotActiveError) {
    return {
      status: 403,
      body: { error: 'Account is not active' },
    };
  }

  return {
    status: 500,
    body: { error: 'Authentication failed' },
  };
}
