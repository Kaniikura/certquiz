/**
 * Update user role validation
 * @fileoverview Input validation for role update operations
 */

import { UserRole } from '@api/features/auth/domain/value-objects/UserRole';
import { z } from 'zod';

/**
 * Valid role values for validation
 */
const validRoles = Object.values(UserRole);

/**
 * Schema for update user role request
 */
export const updateUserRolesSchema = z.object({
  userId: z.string().uuid('Invalid user ID format'),
  role: z.enum(validRoles as [string, ...string[]], {
    errorMap: () => ({ message: 'Invalid role specified' }),
  }),
  updatedBy: z.string().uuid('Invalid updater ID format'),
});
