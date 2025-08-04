/**
 * List users DTOs
 * @fileoverview Request and response types for user listing
 */
import type { UserRole } from '@api/features/auth/domain/value-objects/UserRole';

/**
 * Request parameters for listing users
 */
export interface ListUsersParams {
  page: number;
  pageSize: number;
  search?: string;
  role?: UserRole;
  isActive?: boolean;
}

/**
 * User summary for list display
 */
export interface UserSummary {
  userId: string;
  email: string;
  username: string;
  roles: string[];
  isActive: boolean;
  createdAt: Date;
  lastLoginAt: Date | null;
}
