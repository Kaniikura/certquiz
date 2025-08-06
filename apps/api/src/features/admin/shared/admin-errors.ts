/**
 * Admin module specific errors
 * @fileoverview Custom error classes for admin operations
 */

import { AppError } from '@api/shared/errors';

/**
 * Thrown when an admin operation violates permission rules
 * @example Trying to remove your own admin role
 * @example Invalid role combinations
 */
export class AdminPermissionError extends AppError {
  constructor(message: string) {
    super(message, 'ADMIN_PERMISSION_ERROR', 403);
    this.name = 'AdminPermissionError';
  }
}
