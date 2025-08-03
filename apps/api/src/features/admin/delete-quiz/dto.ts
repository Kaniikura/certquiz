/**
 * Delete quiz DTOs
 * @fileoverview Request and response types for admin quiz deletion
 */

/**
 * Parameters for deleting a quiz
 */
export interface DeleteQuizParams {
  quizId: string;
  deletedBy: string; // Admin user ID
  reason: string; // Required for audit trail
}

/**
 * Response for quiz deletion operation
 */
export interface DeleteQuizResponse {
  success: boolean;
  quizId: string;
  previousState: string;
  deletedBy: string;
  reason: string;
  deletedAt: Date;
}
