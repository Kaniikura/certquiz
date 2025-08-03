import type { UserRole } from '@api/features/auth/domain/value-objects/UserRole';

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
