/**
 * List quizzes DTOs
 * @fileoverview Request and response types for admin quiz listing
 */

/**
 * Query parameters for listing quizzes
 */
export interface ListQuizzesParams {
  page: number;
  pageSize: number;
  state?: string;
  userId?: string;
  dateFrom?: Date;
  dateTo?: Date;
}

/**
 * Quiz summary for admin listing
 */
export interface QuizSummary {
  sessionId: string;
  userId: string;
  userEmail: string;
  state: string;
  score: number | null; // Percentage (0-100) or null for incomplete
  questionCount: number;
  startedAt: Date;
  completedAt: Date | null;
  duration: number | null; // Duration in seconds, null for incomplete
}
