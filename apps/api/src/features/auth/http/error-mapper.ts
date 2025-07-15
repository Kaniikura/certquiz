/**
 * Auth Error Mapper
 * @fileoverview Maps domain errors to HTTP status codes and response bodies
 */

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
  switch (error.name) {
    case 'ValidationError':
      return {
        status: 400,
        body: { error: error.message },
      };
    case 'UserNotFoundError':
    case 'InvalidCredentialsError':
      return {
        status: 401,
        body: { error: 'Invalid credentials' },
      };
    case 'UserNotActiveError':
      return {
        status: 403,
        body: { error: 'Account is not active' },
      };
    default:
      return {
        status: 500,
        body: { error: 'Authentication failed' },
      };
  }
}
