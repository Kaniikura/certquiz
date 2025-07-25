/**
 * Route Helper Functions
 *
 * Common helper functions for route handlers to reduce boilerplate
 */

import type { ContentfulStatusCode } from 'hono/utils/http-status';
/**
 * Standard error mapper that handles common error types
 * Can be extended with feature-specific mappings
 */
export function createErrorMapper(
  featureErrorMappings?: Array<{
    errorName: string;
    status: ContentfulStatusCode;
    code?: string;
    message?: string;
    field?: string;
  }>
): (error: Error) => { status: ContentfulStatusCode; body: Response } {
  return (error: Error) => {
    // Check common errors first
    if (error.name === 'ValidationError') {
      return {
        status: 400,
        body: Response.json(
          {
            success: false,
            error: {
              message: error.message,
              code: 'VALIDATION_ERROR',
            },
          },
          { status: 400 }
        ),
      };
    }

    if (error.name === 'AuthorizationError') {
      return {
        status: 403,
        body: Response.json(
          {
            success: false,
            error: {
              message: error.message,
              code: 'UNAUTHORIZED',
            },
          },
          { status: 403 }
        ),
      };
    }

    // Check feature-specific mappings
    if (featureErrorMappings) {
      const mapping = featureErrorMappings.find((m) => m.errorName === error.name);
      if (mapping) {
        return {
          status: mapping.status,
          body: Response.json(
            {
              success: false,
              error: {
                message: mapping.message || error.message,
                ...(mapping.code && { code: mapping.code }),
                ...(mapping.field && { field: mapping.field }),
              },
            },
            { status: mapping.status }
          ),
        };
      }
    }

    // Default to internal server error
    return {
      status: 500,
      body: Response.json(
        {
          success: false,
          error: {
            message: 'Internal server error',
            code: 'INTERNAL_ERROR',
          },
        },
        { status: 500 }
      ),
    };
  };
}
