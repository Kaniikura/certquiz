/**
 * Fake Premium Access Service
 * @fileoverview Test double for IPremiumAccessService that always allows access
 */

import type { IPremiumAccessService } from '@api/features/question/domain/services/IPremiumAccessService';
import type { QuestionAccessDeniedError } from '@api/features/question/shared/errors';
import { Result } from '@api/shared/result';

/**
 * Fake implementation of IPremiumAccessService for testing
 * Always allows access to premium content regardless of authentication status
 */
export class FakePremiumAccessService implements IPremiumAccessService {
  shouldIncludePremiumContent(
    _isAuthenticated: boolean,
    _requestedPremiumAccess: boolean
  ): boolean {
    // In tests, always include premium content
    return true;
  }

  validatePremiumAccess(
    _isAuthenticated: boolean,
    _isPremiumContent: boolean
  ): Result<void, Error> {
    // In tests, always allow access
    return Result.ok(undefined);
  }

  validateQuestionPremiumAccess(
    _isAuthenticated: boolean,
    _isPremiumContent: boolean,
    _questionId: string
  ): Result<void, QuestionAccessDeniedError> {
    // In tests, always allow access
    return Result.ok(undefined);
  }
}
