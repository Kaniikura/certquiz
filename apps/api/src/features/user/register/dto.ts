import type { UserRole } from '@api/features/auth/domain/value-objects/UserRole';

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
