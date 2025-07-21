/**
 * Update progress use case DTOs
 * @fileoverview Input and output types for user/update-progress
 */

/**
 * Update progress response type for successful progress update
 */
export interface UpdateProgressResponse {
  progress: {
    level: number;
    experience: number;
    totalQuestions: number;
    correctAnswers: number;
    accuracy: number;
    studyTimeMinutes: number;
    currentStreak: number;
    lastStudyDate: Date | null;
    categoryStats: {
      [category: string]: {
        correct: number;
        total: number;
        accuracy: number;
      };
    };
  };
}

/**
 * Update progress error types for domain error mapping
 */
export interface UpdateProgressError {
  code: 'USER_NOT_FOUND' | 'VALIDATION_ERROR' | 'REPOSITORY_ERROR';
  message: string;
  field?: string;
}

// Note: UpdateProgressRequest type is defined in validation.ts using z.infer<typeof updateProgressSchema>
// This ensures the DTO and validation schema never drift apart
