/**
 * Shared error mapping utilities for user routes
 * @fileoverview Provides consistent error response mapping across all user endpoints
 */

import { createErrorMapper } from '@api/shared/route';
import type { ContentfulStatusCode } from 'hono/utils/http-status';

/**
 * Error mapping type definition
 */
type ErrorMapping = {
  errorName: string;
  status: ContentfulStatusCode;
  code: string;
  field?: string;
};

/**
 * User domain error mappings
 */
const userDomainErrorMappings: ErrorMapping[] = [
  // User not found
  {
    errorName: 'UserNotFoundError',
    status: 404,
    code: 'USER_NOT_FOUND',
  },
  // Email already taken
  {
    errorName: 'EmailAlreadyTakenError',
    status: 409,
    code: 'EMAIL_ALREADY_TAKEN',
    field: 'email',
  },
  // Username already taken
  {
    errorName: 'UsernameAlreadyTakenError',
    status: 409,
    code: 'USERNAME_ALREADY_TAKEN',
    field: 'username',
  },
  // Progress update errors
  {
    errorName: 'InvalidProgressError',
    status: 422,
    code: 'INVALID_PROGRESS',
  },
  {
    errorName: 'ProgressUpdateFailedError',
    status: 500,
    code: 'PROGRESS_UPDATE_FAILED',
  },
];

/**
 * User domain error mapper
 * Maps domain errors to HTTP error responses
 */
export const mapUserError = createErrorMapper(userDomainErrorMappings);
