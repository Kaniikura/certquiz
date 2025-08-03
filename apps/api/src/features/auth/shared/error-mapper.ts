import { createErrorMapper } from '@api/shared/route/route-helpers';
import type { ContentfulStatusCode } from 'hono/utils/http-status';

/**
 * Error mapping type definition
 */
type ErrorMapping = {
  errorName: string;
  status: ContentfulStatusCode;
  code: string;
  message?: string;
};

/**
 * Auth domain error mappings
 */
const authDomainErrorMappings: ErrorMapping[] = [
  // User not found - generic message for security
  {
    errorName: 'UserNotFoundError',
    status: 401,
    code: 'INVALID_CREDENTIALS',
    message: 'Invalid credentials',
  },
  // Invalid credentials
  {
    errorName: 'InvalidCredentialsError',
    status: 401,
    code: 'INVALID_CREDENTIALS',
    message: 'Invalid credentials',
  },
  // User not active
  {
    errorName: 'UserNotActiveError',
    status: 403,
    code: 'ACCOUNT_NOT_ACTIVE',
    message: 'Account is not active',
  },
];

/**
 * Auth domain error mapper
 * Maps authentication errors to HTTP responses
 */
export const mapAuthError = createErrorMapper(authDomainErrorMappings);
