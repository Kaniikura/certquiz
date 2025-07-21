/**
 * Get profile request validation schema
 * @fileoverview Zod schema for profile retrieval input validation with type inference
 */

import { z } from 'zod';

/**
 * Get profile request validation schema
 * Validates user ID for profile retrieval
 */
export const getProfileSchema = z.object({
  userId: z.string().min(1, 'User ID is required').uuid('Invalid user ID format'),
});

/**
 * Inferred type from validation schema
 * This ensures DTO and validation schema never drift apart
 */
export type GetProfileRequest = z.infer<typeof getProfileSchema>;
