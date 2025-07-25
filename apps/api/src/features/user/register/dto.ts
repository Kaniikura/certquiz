/**
 * Register use case DTOs
 * @fileoverview Input and output types for user/register
 */

import type { UserRole } from '../domain/value-objects';

/**
 * Register response type for successful user creation
 */
export interface RegisterResponse {
  user: {
    id: string;
    email: string;
    username: string;
    role: UserRole;
    isActive: boolean;
    progress: {
      level: number;
      experience: number;
      currentStreak: number;
    };
  };
}
