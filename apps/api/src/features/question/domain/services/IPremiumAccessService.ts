/**
 * Premium Access Service Interface
 * @fileoverview Service interface for managing premium content access rules
 */

import type { Result } from '@api/shared/result';

/**
 * Service for managing premium content access across question operations
 *
 * This service encapsulates the business logic for determining premium access
 * and can be reused across different question-related use cases.
 */
export interface IPremiumAccessService {
  /**
   * Determines whether premium content should be included in results
   * Used for filtering operations like listing questions
   *
   * Business Rule: Only authenticated users can access premium content
   * If an unauthenticated user requests premium content, it should be silently ignored
   *
   * @param isAuthenticated - Whether the user is authenticated
   * @param requestedPremiumAccess - Whether the user explicitly requested premium content
   * @returns true if premium content should be included in results
   */
  shouldIncludePremiumContent(isAuthenticated: boolean, requestedPremiumAccess: boolean): boolean;

  /**
   * Validates whether a user can access specific premium content
   * Used for access control on individual premium items
   *
   * Business Rule: Authenticated users can access any content
   * Unauthenticated users can only access non-premium content
   *
   * @param isAuthenticated - Whether the user is authenticated
   * @param isPremiumContent - Whether the content is premium
   * @returns Success result if access is allowed, failure with error if denied
   */
  validatePremiumAccess(isAuthenticated: boolean, isPremiumContent: boolean): Result<void, Error>;

  /**
   * Validates premium access for a specific question
   * Used for question-specific access control with proper error context
   *
   * @param isAuthenticated - Whether the user is authenticated
   * @param isPremiumContent - Whether the question is premium
   * @param questionId - Question ID for error context
   * @returns Success result if access is allowed, failure with QuestionAccessDeniedError if denied
   */
  validateQuestionPremiumAccess(
    isAuthenticated: boolean,
    isPremiumContent: boolean,
    questionId: string
  ): Result<void, Error>;
}
