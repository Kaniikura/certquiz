/**
 * List users validation
 * @fileoverview Input validation for user listing parameters
 */

import { UserRole } from '@api/features/auth/domain/value-objects/UserRole';
import { z } from 'zod';

/**
 * Valid role values for validation
 */
const validRoles = Object.values(UserRole) as [string, ...string[]];

/**
 * Schema for list users request parameters
 */
export const listUsersSchema = z.object({
  page: z.number().int().min(1, 'Page must be at least 1'),
  pageSize: z
    .number()
    .int()
    .min(1, 'Page size must be at least 1')
    .max(100, 'Page size cannot exceed 100'),
  search: z.string().optional(),
  role: z.enum(validRoles).optional() as z.ZodOptional<z.ZodType<UserRole>>,
  isActive: z.boolean().optional(),
});
