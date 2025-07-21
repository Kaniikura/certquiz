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

/**
 * Register error types for domain error mapping
 */
export interface RegisterError {
  code: 'EMAIL_ALREADY_TAKEN' | 'USERNAME_ALREADY_TAKEN' | 'VALIDATION_ERROR' | 'REPOSITORY_ERROR';
  message: string;
  field?: string;
}

// Note: RegisterRequest type is defined in validation.ts using z.infer<typeof registerSchema>
// This ensures the DTO and validation schema never drift apart
