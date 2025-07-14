/**
 * Login request validation schema
 * @fileoverview Zod schema for login input validation with type inference
 */

import { z } from 'zod';

/**
 * Login request validation schema
 * Validates email format and password minimum length
 */
export const loginSchema = z.object({
  email: z
    .string()
    .min(1, 'Email is required')
    .email('Invalid email format')
    .max(255, 'Email too long'),
  password: z.string().min(1, 'Password is required').max(128, 'Password too long'), // Don't enforce min length here - identity provider handles that
});

/**
 * Inferred type from validation schema
 * This ensures DTO and validation schema never drift apart
 */
export type LoginRequest = z.infer<typeof loginSchema>;
