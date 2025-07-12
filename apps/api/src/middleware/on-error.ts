import { AppError, AuthenticationError, NotFoundError, ValidationError } from '@api/shared/errors';
import type { ErrorHandler } from 'hono';
import { HTTPException } from 'hono/http-exception';
import type {
  ClientErrorStatusCode,
  ContentfulStatusCode,
  ServerErrorStatusCode,
} from 'hono/utils/http-status';

type ErrorBody<C extends string = string> = {
  error: {
    message: string;
    code: C;
    details?: unknown;
  };
};

/**
 * Type guard to check if value is Error-like
 */
function isErrorLike(e: unknown): e is Error {
  return typeof e === 'object' && e !== null && 'message' in e;
}

/**
 * Check if running in production environment
 */
function isProd(): boolean {
  return process.env.NODE_ENV === 'production';
}

/**
 * Look up status code for known error types
 */
function lookupKnownStatus(err: unknown): ClientErrorStatusCode | ServerErrorStatusCode | null {
  if (err instanceof ValidationError) return 400;
  if (err instanceof AuthenticationError) return 401;
  if (err instanceof NotFoundError) return 404;
  return null;
}

/**
 * Global error handler for the application
 *
 * Handles:
 * - HTTPException from Hono
 * - AppError and subclasses from domain/application layers
 * - Unexpected errors
 *
 * All errors are logged with the request logger and returned as JSON.
 */
export const errorHandler: ErrorHandler = (err, c) => {
  const logger = c.get('logger') ?? console;

  // Handle HTTPException (thrown by Hono middleware)
  if (err instanceof HTTPException) {
    logger.warn({ err, status: err.status }, 'HTTP exception');
    return err.getResponse();
  }

  // Handle our custom AppError hierarchy
  if (err instanceof AppError) {
    const status = mapErrorToStatus(err);
    const level = status >= 500 ? 'error' : 'warn';

    logger[level](
      {
        err,
        status,
      },
      'App error'
    );

    const body: ErrorBody<typeof err.code> = {
      error: {
        message: err.message,
        code: err.code,
        // Only include details for validation errors and not in production
        ...(status === 400 && err.details && !isProd() ? { details: err.details } : {}),
      },
    };

    return c.json(body, status);
  }

  // Handle unexpected errors
  logger.error({ err }, 'Unhandled error');

  const body: ErrorBody<'INTERNAL_ERROR'> = {
    error: {
      message: isProd()
        ? 'Internal server error'
        : isErrorLike(err)
          ? err.message
          : 'Unknown error',
      code: 'INTERNAL_ERROR',
    },
  };

  return c.json(body, 500);
};

/**
 * Clamp status code to valid HTTP error range that can carry content
 */
function clampStatus(code: number): ContentfulStatusCode {
  if (Number.isInteger(code) && code >= 400 && code < 600) {
    return code as ContentfulStatusCode;
  }
  return 500;
}

/**
 * Maps errors to HTTP status codes with proper TypeScript typing
 */
function mapErrorToStatus(err: unknown): ContentfulStatusCode {
  // Check if AppError has a custom status code
  if (err instanceof AppError && err.statusCode) {
    return clampStatus(err.statusCode);
  }

  // Check our known error types
  const knownStatus = lookupKnownStatus(err);
  if (knownStatus !== null) return knownStatus;

  // Default to 500
  return 500;
}

/**
 * Helper to convert Result errors to HTTPException
 * Used in route handlers to throw appropriate errors
 *
 * @example
 * ```typescript
 * const result = await createUser(data);
 * if (!result.success) throw toHttpError(result.error);
 * ```
 */
export function toHttpError(error: unknown): HTTPException {
  const status = mapErrorToStatus(error);
  const message = isErrorLike(error) ? error.message : 'Error';
  return new HTTPException(status, {
    message,
    cause: error,
  });
}
