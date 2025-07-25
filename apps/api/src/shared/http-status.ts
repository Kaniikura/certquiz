/**
 * HTTP Status Code Constants
 * @fileoverview Centralized HTTP status codes for API responses
 *
 * Transport-layer only. Do NOT import this inside pure domain code.
 * Domain errors should use the error classes in shared/errors.ts
 */

/**
 * HTTP Status Codes used across the application
 *
 * This is a curated subset of status codes that we explicitly support.
 * By limiting the exported codes, we prevent accidental use of uncommon
 * status codes and maintain consistency across the API.
 */
export const HttpStatus = {
  // 2xx Success
  /** 200 - The request has succeeded */
  OK: 200,
  /** 201 - The request has succeeded and a new resource has been created */
  CREATED: 201,
  /** 204 - The server successfully processed the request and is not returning any content */
  NO_CONTENT: 204,

  // 4xx Client Errors
  /** 400 - The request contains invalid data or malformed syntax */
  BAD_REQUEST: 400,
  /** 401 - The request requires authentication */
  UNAUTHORIZED: 401,
  /** 403 - The user lacks permission to access this resource */
  FORBIDDEN: 403,
  /** 404 - The requested resource was not found */
  NOT_FOUND: 404,
  /** 409 - The request conflicts with current state */
  CONFLICT: 409,
  /** 422 - The request is well-formed but contains invalid data */
  UNPROCESSABLE_ENTITY: 422,
  /** 429 - Too many requests sent in a given amount of time */
  RATE_LIMIT: 429,

  // 5xx Server Errors
  /** 500 - An unexpected server error occurred */
  INTERNAL_SERVER_ERROR: 500,
  /** 503 - The service is temporarily unavailable */
  SERVICE_UNAVAILABLE: 503,
} as const satisfies Record<string, number>;
