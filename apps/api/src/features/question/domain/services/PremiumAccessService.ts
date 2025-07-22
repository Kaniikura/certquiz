/**
 * Premium Access Service Implementation
 * @fileoverview Concrete implementation of premium content access business rules
 */

import { Result } from '@api/shared/result';
import { QuestionAccessDeniedError } from '../../shared/errors';
import type { IPremiumAccessService } from './IPremiumAccessService';

/**
 * Service implementation for managing premium content access
 *
 * Encapsulates all business rules related to premium content access:
 * - Authentication-based access control
 * - Silent filtering for list operations
 * - Explicit access denial for individual items
 */
export class PremiumAccessService implements IPremiumAccessService {
  /**
   * Determines whether premium content should be included in results
   *
   * Business Logic:
   * - Only authenticated users can access premium content
   * - If unauthenticated user requests premium, silently ignore (filter out)
   * - This ensures graceful degradation without exposing premium content existence
   *
   * @param isAuthenticated - Whether the user is authenticated
   * @param requestedPremiumAccess - Whether the user explicitly requested premium content
   * @returns true if premium content should be included in results
   */
  shouldIncludePremiumContent(isAuthenticated: boolean, requestedPremiumAccess: boolean): boolean {
    // Premium content is only included if:
    // 1. User is authenticated (has valid session/token)
    // 2. User explicitly requested premium content (includePremium=true)
    return isAuthenticated && requestedPremiumAccess;
  }

  /**
   * Validates whether a user can access specific premium content
   *
   * Business Logic:
   * - Authenticated users can access any content (premium or non-premium)
   * - Unauthenticated users can only access non-premium content
   * - Premium content access for unauthenticated users results in access denied error
   *
   * @param isAuthenticated - Whether the user is authenticated
   * @param isPremiumContent - Whether the content is premium
   * @returns Success result if access is allowed, failure with error if denied
   */
  validatePremiumAccess(isAuthenticated: boolean, isPremiumContent: boolean): Result<void, Error> {
    // Non-premium content is always accessible
    if (!isPremiumContent) {
      return Result.ok(undefined);
    }

    // Premium content requires authentication
    if (!isAuthenticated) {
      return Result.fail(new Error('Authentication required to access premium content'));
    }

    // Authenticated users can access premium content
    return Result.ok(undefined);
  }

  /**
   * Validates premium access for a specific question with proper error context
   *
   * Business Logic:
   * - Same as validatePremiumAccess but with question-specific error
   * - Provides better error context for question access scenarios
   * - Uses QuestionAccessDeniedError for consistent error handling
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
  ): Result<void, Error> {
    // Non-premium questions are always accessible
    if (!isPremiumContent) {
      return Result.ok(undefined);
    }

    // Premium questions require authentication
    if (!isAuthenticated) {
      return Result.fail(
        new QuestionAccessDeniedError(
          questionId,
          'Authentication required to access premium question'
        )
      );
    }

    // Authenticated users can access premium questions
    return Result.ok(undefined);
  }
}
