/**
 * Get profile use case DTOs
 * @fileoverview Input and output types for user/get-profile
 */

import type { UserRole } from '../domain/value-objects';

/**
 * Get profile response type for successful profile retrieval
 */
export interface GetProfileResponse {
  user: {
    id: string;
    email: string;
    username: string;
    role: UserRole;
    isActive: boolean;
    identityProviderId: string | null;
    createdAt: Date;
    updatedAt: Date;
    progress: {
      level: number;
      experience: number;
      totalQuestions: number;
      correctAnswers: number;
      accuracy: number;
      studyTimeMinutes: number;
      currentStreak: number;
      lastStudyDate: Date | null;
      streakLevel: string;
      categoryStats: {
        [category: string]: {
          correct: number;
          total: number;
          accuracy: number;
        };
      };
    };
  };
}

/**
 * Get profile error types for domain error mapping
 */
export interface GetProfileError {
  code: 'USER_NOT_FOUND' | 'VALIDATION_ERROR' | 'REPOSITORY_ERROR';
  message: string;
  field?: string;
}

// Note: GetProfileRequest type is defined in validation.ts using z.infer<typeof getProfileSchema>
// This ensures the DTO and validation schema never drift apart
