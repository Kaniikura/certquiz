/**
 * Moderate Questions DTO Types
 * @fileoverview Request and response types for question moderation
 */

import type { QuestionStatus } from '@api/features/question/domain/entities/Question';
import type { QuestionId } from '@api/features/quiz/domain/value-objects/Ids';

/**
 * Moderation action types
 */
export type ModerationAction = 'approve' | 'reject' | 'request_changes';

/**
 * Request parameters for question moderation
 */
export interface ModerateQuestionParams {
  /** Question identifier to moderate */
  questionId: QuestionId;
  /** Moderation action to perform */
  action: ModerationAction;
  /** Admin user performing the moderation */
  moderatedBy: string;
  /** Optional feedback (required for reject and request_changes) */
  feedback?: string;
}

/**
 * Response for question moderation action
 */
export interface ModerateQuestionResponse {
  /** Operation success flag */
  success: boolean;
  /** Question identifier */
  questionId: QuestionId;
  /** Previous question status */
  previousStatus: string;
  /** New question status after moderation */
  newStatus: string;
  /** Admin who performed the moderation */
  moderatedBy: string;
  /** Timestamp of moderation action */
  moderatedAt: Date;
  /** Action performed */
  action: ModerationAction;
  /** Feedback provided (if any) */
  feedback?: string;
}

/**
 * Status mapping for moderation actions
 */
export const ModerationActionToStatus: Record<ModerationAction, QuestionStatus> = {
  approve: 'active' as QuestionStatus,
  reject: 'archived' as QuestionStatus,
  request_changes: 'draft' as QuestionStatus,
} as const;

/**
 * Human-readable status names for responses
 */
export const StatusToDisplayName: Record<QuestionStatus, string> = {
  active: 'APPROVED',
  inactive: 'INACTIVE',
  draft: 'PENDING',
  archived: 'REJECTED',
} as const;
