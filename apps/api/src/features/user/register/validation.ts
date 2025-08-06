/**
 * Register request validation schema
 * @fileoverview Zod schema for user registration input validation with type inference
 */

import { UserRole } from '@api/features/auth/domain/value-objects/UserRole';
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
  role: z.enum(UserRole.USER_ROLE_TUPLE).optional().default('user'),
});
