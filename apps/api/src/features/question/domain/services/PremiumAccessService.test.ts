/**
 * Premium Access Service Tests
 * @fileoverview Unit tests for premium content access business rules
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { QuestionAccessDeniedError } from '../../shared/errors';
import { PremiumAccessService } from './PremiumAccessService';

describe('PremiumAccessService', () => {
  let service: PremiumAccessService;

  beforeEach(() => {
    service = new PremiumAccessService();
  });

  describe('shouldIncludePremiumContent', () => {
    describe('when user is authenticated', () => {
      it('should return true when premium content is requested', () => {
        const result = service.shouldIncludePremiumContent(true, true);
        expect(result).toBe(true);
      });

      it('should return false when premium content is not requested', () => {
        const result = service.shouldIncludePremiumContent(true, false);
        expect(result).toBe(false);
      });
    });

    describe('when user is not authenticated', () => {
      it('should return false when premium content is requested (silent filtering)', () => {
        const result = service.shouldIncludePremiumContent(false, true);
        expect(result).toBe(false);
      });

      it('should return false when premium content is not requested', () => {
        const result = service.shouldIncludePremiumContent(false, false);
        expect(result).toBe(false);
      });
    });

    describe('edge cases', () => {
      it('should handle both parameters being false', () => {
        const result = service.shouldIncludePremiumContent(false, false);
        expect(result).toBe(false);
      });

      it('should require both authentication AND request for premium content', () => {
        // Only authentication is not enough
        expect(service.shouldIncludePremiumContent(true, false)).toBe(false);
        // Only request is not enough
        expect(service.shouldIncludePremiumContent(false, true)).toBe(false);
        // Both are required
        expect(service.shouldIncludePremiumContent(true, true)).toBe(true);
      });
    });
  });

  describe('validatePremiumAccess', () => {
    describe('for non-premium content', () => {
      it('should allow access for authenticated users', () => {
        const result = service.validatePremiumAccess(true, false);
        expect(result.success).toBe(true);
      });

      it('should allow access for unauthenticated users', () => {
        const result = service.validatePremiumAccess(false, false);
        expect(result.success).toBe(true);
      });
    });

    describe('for premium content', () => {
      it('should allow access for authenticated users', () => {
        const result = service.validatePremiumAccess(true, true);
        expect(result.success).toBe(true);
      });

      it('should deny access for unauthenticated users', () => {
        const result = service.validatePremiumAccess(false, true);
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.message).toBe('Authentication required to access premium content');
        }
      });
    });
  });

  describe('validateQuestionPremiumAccess', () => {
    const questionId = 'test-question-123';

    describe('for non-premium questions', () => {
      it('should allow access for authenticated users', () => {
        const result = service.validateQuestionPremiumAccess(true, false, questionId);
        expect(result.success).toBe(true);
      });

      it('should allow access for unauthenticated users', () => {
        const result = service.validateQuestionPremiumAccess(false, false, questionId);
        expect(result.success).toBe(true);
      });
    });

    describe('for premium questions', () => {
      it('should allow access for authenticated users', () => {
        const result = service.validateQuestionPremiumAccess(true, true, questionId);
        expect(result.success).toBe(true);
      });

      it('should deny access for unauthenticated users with QuestionAccessDeniedError', () => {
        const result = service.validateQuestionPremiumAccess(false, true, questionId);
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error).toBeInstanceOf(QuestionAccessDeniedError);
          expect(result.error.message).toContain(
            'Authentication required to access premium question'
          );
        }
      });

      it('should include question ID in error for proper context', () => {
        const result = service.validateQuestionPremiumAccess(false, true, questionId);
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error).toBeInstanceOf(QuestionAccessDeniedError);
          expect(result.error.message).toContain(questionId);
        }
      });
    });

    describe('edge cases', () => {
      it('should handle empty question ID', () => {
        const result = service.validateQuestionPremiumAccess(false, true, '');
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error).toBeInstanceOf(QuestionAccessDeniedError);
        }
      });

      it('should handle special characters in question ID', () => {
        const specialId = 'test-question-!@#$%^&*()';
        const result = service.validateQuestionPremiumAccess(false, true, specialId);
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.message).toContain(specialId);
        }
      });
    });
  });

  describe('business rule consistency', () => {
    it('should have consistent access rules across all methods', () => {
      // Test scenario: authenticated user, premium content requested
      const shouldInclude = service.shouldIncludePremiumContent(true, true);
      const generalValidation = service.validatePremiumAccess(true, true);
      const questionValidation = service.validateQuestionPremiumAccess(true, true, 'test');

      expect(shouldInclude).toBe(true);
      expect(generalValidation.success).toBe(true);
      expect(questionValidation.success).toBe(true);
    });

    it('should consistently deny access for unauthenticated premium access', () => {
      // Test scenario: unauthenticated user, premium content
      const shouldInclude = service.shouldIncludePremiumContent(false, true);
      const generalValidation = service.validatePremiumAccess(false, true);
      const questionValidation = service.validateQuestionPremiumAccess(false, true, 'test');

      expect(shouldInclude).toBe(false);
      expect(generalValidation.success).toBe(false);
      expect(questionValidation.success).toBe(false);
    });

    it('should consistently allow non-premium content access', () => {
      // Test scenario: non-premium content (authentication status irrelevant)
      const scenarios = [
        { authenticated: true, premium: false },
        { authenticated: false, premium: false },
      ];

      scenarios.forEach(({ authenticated, premium }) => {
        const generalValidation = service.validatePremiumAccess(authenticated, premium);
        const questionValidation = service.validateQuestionPremiumAccess(
          authenticated,
          premium,
          'test'
        );

        expect(generalValidation.success).toBe(true);
        expect(questionValidation.success).toBe(true);
      });
    });
  });
});
