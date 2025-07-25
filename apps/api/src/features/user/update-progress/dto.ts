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
