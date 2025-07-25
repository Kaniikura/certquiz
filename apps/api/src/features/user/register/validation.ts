/**
 * Register request validation schema
 * @fileoverview Zod schema for user registration input validation with type inference
 */

import { z } from 'zod';

/**
 * Register request validation schema
 * Validates email format, username format, and optional fields
 */
export const registerSchema = z.object({
  email: z
    .string()
    .min(1, 'Email is required')
    .email('Invalid email format')
    .max(255, 'Email too long'),
  username: z
    .string()
    .min(2, 'Username must be at least 2 characters')
    .max(50, 'Username must be at most 50 characters')
    .regex(
      /^[a-zA-Z0-9_-]+$/,
      'Username can only contain letters, numbers, underscores, and hyphens'
    ),
  identityProviderId: z.string().optional(),
  role: z.enum(['guest', 'user', 'premium', 'admin']).optional().default('user'),
});
