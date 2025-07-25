/**
 * Tests for shared validation constants
 * @fileoverview Unit tests for validation patterns and helper functions
 */

import { describe, expect, it } from 'vitest';
import { isValidUUID, UUID_REGEX } from './constants';

describe('UUID Validation', () => {
  describe('UUID_REGEX', () => {
    it('should match valid UUID formats', () => {
      const validUUIDs = [
        '123e4567-e89b-12d3-a456-426614174000',
        '550e8400-e29b-41d4-a716-446655440000',
        'f47ac10b-58cc-4372-a567-0e02b2c3d479',
        'A987FBC9-4BED-3078-CF07-9141BA07C9F3', // uppercase
        'a987fbc9-4bed-3078-cf07-9141ba07c9f3', // lowercase
      ];

      validUUIDs.forEach((uuid) => {
        expect(UUID_REGEX.test(uuid)).toBe(true);
      });
    });

    it('should not match invalid UUID formats', () => {
      const invalidUUIDs = [
        '123e4567-e89b-12d3-a456-42661417400g', // contains 'g'
        '123e4567e89b12d3a456426614174000', // missing hyphens
        '123e4567-e89b-12d3-a456-42661417400', // too short
        '123e4567-e89b-12d3-a456-4266141740000', // too long
        '123e4567-e89b-12d3-a456', // incomplete
        'not-a-uuid',
        '',
        '123e4567_e89b_12d3_a456_426614174000', // underscores instead of hyphens
      ];

      invalidUUIDs.forEach((uuid) => {
        expect(UUID_REGEX.test(uuid)).toBe(false);
      });
    });
  });

  describe('isValidUUID', () => {
    it('should return true for valid UUIDs', () => {
      expect(isValidUUID('123e4567-e89b-12d3-a456-426614174000')).toBe(true);
      expect(isValidUUID('A987FBC9-4BED-3078-CF07-9141BA07C9F3')).toBe(true);
    });

    it('should return false for invalid UUIDs', () => {
      expect(isValidUUID('not-a-uuid')).toBe(false);
      expect(isValidUUID('')).toBe(false);
      expect(isValidUUID('123e4567e89b12d3a456426614174000')).toBe(false);
    });
  });
});
