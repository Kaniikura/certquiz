import type { ErrorHandler } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { AppError, AuthenticationError, NotFoundError, ValidationError } from '../shared/errors';

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
  const logger = c.get('logger') || console;

  // Handle HTTPException (thrown by Hono middleware)
  if (err instanceof HTTPException) {
    const response = err.getResponse();
    logger.warn(
      {
        error: err.message,
        status: response.status,
      },
      'HTTP exception'
    );
    return response;
  }

  // Handle our custom AppError hierarchy
  if (err instanceof AppError) {
    const status = getStatusCode(err);
    logger.warn(
      {
        error: err.message,
        code: err.code,
        status,
        details: err.details,
      },
      'Application error'
    );

    // Create response based on status code
    switch (status) {
      case 400:
        return c.json(
          {
            error: {
              message: err.message,
              code: err.code,
              ...(err.details !== undefined && { details: err.details }),
            },
          },
          400
        );
      case 401:
        return c.json(
          {
            error: {
              message: err.message,
              code: err.code,
            },
          },
          401
        );
      case 404:
        return c.json(
          {
            error: {
              message: err.message,
              code: err.code,
            },
          },
          404
        );
      default:
        return c.json(
          {
            error: {
              message: err.message,
              code: err.code,
            },
          },
          500
        );
    }
  }

  // Handle unexpected errors
  logger.error(
    {
      error: err.message,
      stack: err.stack,
      name: err.name,
    },
    'Unhandled error'
  );

  // Don't leak internal errors in production
  const message =
    process.env.NODE_ENV === 'production'
      ? 'Internal server error'
      : err.message || 'Unknown error';

  return c.json(
    {
      error: {
        message,
        code: 'INTERNAL_ERROR',
      },
    },
    500
  );
};

/**
 * Maps AppError subclasses to HTTP status codes
 */
function getStatusCode(error: AppError): number {
  if (error instanceof ValidationError) return 400;
  if (error instanceof AuthenticationError) return 401;
  if (error instanceof NotFoundError) return 404;

  // Default status from error or 500
  return error.statusCode || 500;
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
export function toHttpError(error: Error): HTTPException {
  if (error instanceof AppError) {
    const status = getStatusCode(error);
    // Use specific status codes that Hono accepts
    switch (status) {
      case 400:
        return new HTTPException(400, { message: error.message });
      case 401:
        return new HTTPException(401, { message: error.message });
      case 404:
        return new HTTPException(404, { message: error.message });
      default:
        return new HTTPException(500, { message: error.message });
    }
  }
  return new HTTPException(500, { message: error.message });
}
