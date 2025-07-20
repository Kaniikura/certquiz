/**
 * Get results validation schemas
 * @fileoverview Zod schemas for get results request validation
 */

import { z } from 'zod';

/**
 * Validation schema for get results request
 * Since this is a GET request, there's no body to validate
 * Session ID comes from URL parameter and is validated by the route handler
 */
export const getResultsSchema = z.object({});

export type GetResultsSchemaType = z.infer<typeof getResultsSchema>;
