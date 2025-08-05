/**
 * List Pending Questions DTO Types
 * @fileoverview Request and response types for listing questions pending moderation
 */

import { QuestionStatus } from '@api/features/question/domain/entities/Question';
import type { QuestionDifficulty } from '@api/features/question/domain/value-objects/QuestionDifficulty';
import type { QuestionId } from '@api/features/quiz/domain/value-objects/Ids';
import type { PaginatedResponse } from '@api/shared/types/pagination';

/**
 * Request parameters for listing pending questions
 */
export interface ListPendingQuestionsParams {
  /** Page number (1-based) */
  page: number;
  /** Items per page (max 100) */
  pageSize: number;
  /** Filter by status (optional, defaults to DRAFT) */
  status?: 'DRAFT' | 'ACTIVE' | 'INACTIVE' | 'ARCHIVED';
  /** Filter by creation date from */
  dateFrom?: Date;
  /** Filter by creation date to */
  dateTo?: Date;
  /** Filter by exam type */
  examType?: string;
  /** Filter by difficulty */
  difficulty?: QuestionDifficulty;
  /** Order by field */
  orderBy?: 'createdAt' | 'updatedAt';
  /** Order direction */
  orderDir?: 'asc' | 'desc';
}

/**
 * Question information for admin moderation view
 */
export interface PendingQuestionInfo {
  /** Question identifier */
  questionId: QuestionId;
  /** Question text (truncated for listing) */
  questionText: string;
  /** Question type */
  questionType: 'multiple_choice' | 'multiple_select' | 'true_false';
  /** Exam types this question belongs to */
  examTypes: string[];
  /** Question categories */
  categories: string[];
  /** Question difficulty level */
  difficulty: QuestionDifficulty;
  /** Current status */
  status: QuestionStatus;
  /** Whether this is premium content */
  isPremium: boolean;
  /** Question tags */
  tags: string[];
  /** User who created the question */
  createdById: string;
  /** Creation timestamp */
  createdAt: Date;
  /** Last update timestamp */
  updatedAt: Date;
  /** Days since submission (for priority) */
  daysPending: number;
  /** Priority level based on days pending */
  priority: 'low' | 'medium' | 'high' | 'urgent';
}

/**
 * Response for listing pending questions
 */
export interface ListPendingQuestionsResponse extends PaginatedResponse<PendingQuestionInfo> {
  /** Summary statistics */
  summary: {
    /** Total pending questions across all pages */
    totalPending: number;
    /** Average days pending for questions in current page only */
    currentPageAverageDaysPending: number;
    /** Priority counts for questions in current page only */
    priorityCounts: {
      low: number;
      medium: number;
      high: number;
      urgent: number;
    };
  };
}

/**
 * Status mapping for filtering
 */
export const StatusToQuestionStatus: Record<string, QuestionStatus> = {
  DRAFT: QuestionStatus.DRAFT,
  ACTIVE: QuestionStatus.ACTIVE,
  INACTIVE: QuestionStatus.INACTIVE,
  ARCHIVED: QuestionStatus.ARCHIVED,
} as const;

/**
 * Calculate priority based on days pending
 */
export function calculatePriority(daysPending: number): 'low' | 'medium' | 'high' | 'urgent' {
  if (daysPending >= 14) return 'urgent'; // 2+ weeks
  if (daysPending >= 7) return 'high'; // 1+ weeks
  if (daysPending >= 3) return 'medium'; // 3+ days
  return 'low'; // < 3 days
}
