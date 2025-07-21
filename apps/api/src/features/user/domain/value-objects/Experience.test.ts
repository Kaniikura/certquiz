import { ValidationError } from '@api/shared/errors';
import { describe, expect, it } from 'vitest';
import { Experience } from './Experience';

describe('Experience', () => {
  describe('create', () => {
    it('should create valid experience', () => {
      const result = Experience.create(500);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.value).toBe(500);
      }
    });

    it('should create experience with 0 value', () => {
      const result = Experience.create(0);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.value).toBe(0);
      }
    });

    it('should fail when experience is negative', () => {
      const result = Experience.create(-1);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(ValidationError);
        expect(result.error.message).toBe('Experience cannot be negative');
      }
    });

    it('should fail when experience is not an integer', () => {
      const result = Experience.create(100.5);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(ValidationError);
        expect(result.error.message).toBe('Experience must be a whole number');
      }
    });

    it('should fail when experience exceeds maximum', () => {
      const result = Experience.create(1000001);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(ValidationError);
        expect(result.error.message).toBe('Experience cannot exceed 1000000');
      }
    });
  });

  describe('add', () => {
    it('should add experience points', () => {
      const expResult = Experience.create(100);
      expect(expResult.success).toBe(true);
      if (expResult.success) {
        const result = expResult.data.add(50);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.value).toBe(150);
        }
      }
    });

    it('should not add negative points', () => {
      const expResult = Experience.create(100);
      expect(expResult.success).toBe(true);
      if (expResult.success) {
        const result = expResult.data.add(-50);
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.message).toBe('Cannot add negative experience');
        }
      }
    });

    it('should cap at maximum experience', () => {
      const expResult = Experience.create(999990);
      expect(expResult.success).toBe(true);
      if (expResult.success) {
        const result = expResult.data.add(20);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.value).toBe(1000000); // Capped at max
        }
      }
    });
  });

  describe('calculatePoints', () => {
    it('should calculate points for correct answer', () => {
      const points = Experience.calculatePoints(true, 1); // correct, normal difficulty
      expect(points).toBe(10);
    });

    it('should calculate points for incorrect answer', () => {
      const points = Experience.calculatePoints(false, 1); // incorrect
      expect(points).toBe(2); // Base consolation points
    });

    it('should apply difficulty multiplier', () => {
      expect(Experience.calculatePoints(true, 1)).toBe(10); // Easy
      expect(Experience.calculatePoints(true, 2)).toBe(20); // Medium
      expect(Experience.calculatePoints(true, 3)).toBe(30); // Hard
    });

    it('should handle unknown difficulty', () => {
      const points = Experience.calculatePoints(true, 99); // Unknown difficulty
      expect(points).toBe(10); // Falls back to easy
    });
  });

  describe('toString', () => {
    it('should return string representation', () => {
      const result = Experience.create(1500);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.toString()).toBe('1500');
      }
    });
  });

  describe('equals', () => {
    it('should return true for equal experience', () => {
      const result1 = Experience.create(500);
      const result2 = Experience.create(500);

      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);
      if (result1.success && result2.success) {
        expect(result1.data.equals(result2.data)).toBe(true);
      }
    });

    it('should return false for different experience', () => {
      const result1 = Experience.create(500);
      const result2 = Experience.create(600);

      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);
      if (result1.success && result2.success) {
        expect(result1.data.equals(result2.data)).toBe(false);
      }
    });
  });
});
