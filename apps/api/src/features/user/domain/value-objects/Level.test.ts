import { ValidationError } from '@api/shared/errors';
import { describe, expect, it } from 'vitest';
import { Level } from './Level';

describe('Level', () => {
  describe('create', () => {
    it('should create a valid level', () => {
      const result = Level.create(5);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.value).toBe(5);
      }
    });

    it('should fail when level is less than 1', () => {
      const result = Level.create(0);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(ValidationError);
        expect(result.error.message).toBe('Level must be at least 1');
      }
    });

    it('should fail when level is greater than max', () => {
      const result = Level.create(101);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(ValidationError);
        expect(result.error.message).toBe('Level cannot exceed 100');
      }
    });

    it('should fail when level is not an integer', () => {
      const result = Level.create(5.5);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(ValidationError);
        expect(result.error.message).toBe('Level must be a whole number');
      }
    });
  });

  describe('fromExperience', () => {
    it('should calculate level 1 for 0-99 XP', () => {
      expect(Level.fromExperience(0).value).toBe(1);
      expect(Level.fromExperience(50).value).toBe(1);
      expect(Level.fromExperience(99).value).toBe(1);
    });

    it('should calculate level 2 for 100-199 XP', () => {
      expect(Level.fromExperience(100).value).toBe(2);
      expect(Level.fromExperience(150).value).toBe(2);
      expect(Level.fromExperience(199).value).toBe(2);
    });

    it('should calculate level 5 for 400-499 XP', () => {
      expect(Level.fromExperience(400).value).toBe(5);
      expect(Level.fromExperience(450).value).toBe(5);
      expect(Level.fromExperience(499).value).toBe(5);
    });

    it('should calculate level 10 for 900-999 XP', () => {
      expect(Level.fromExperience(900).value).toBe(10);
      expect(Level.fromExperience(950).value).toBe(10);
      expect(Level.fromExperience(999).value).toBe(10);
    });

    it('should cap at level 100 for very high XP', () => {
      expect(Level.fromExperience(10000).value).toBe(100);
      expect(Level.fromExperience(999999).value).toBe(100);
    });
  });

  describe('experienceRequired', () => {
    it('should return XP required for next level', () => {
      const result1 = Level.create(1);
      expect(result1.success).toBe(true);
      if (result1.success) {
        expect(result1.data.experienceRequired()).toBe(100);
      }

      const result5 = Level.create(5);
      expect(result5.success).toBe(true);
      if (result5.success) {
        expect(result5.data.experienceRequired()).toBe(500);
      }

      const result10 = Level.create(10);
      expect(result10.success).toBe(true);
      if (result10.success) {
        expect(result10.data.experienceRequired()).toBe(1000);
      }
    });

    it('should return 0 for max level', () => {
      const result = Level.create(100);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.experienceRequired()).toBe(0);
      }
    });
  });

  describe('experienceForLevel', () => {
    it('should return total XP needed to reach a level', () => {
      const result1 = Level.create(1);
      expect(result1.success).toBe(true);
      if (result1.success) {
        expect(result1.data.experienceForLevel()).toBe(0);
      }

      const result2 = Level.create(2);
      expect(result2.success).toBe(true);
      if (result2.success) {
        expect(result2.data.experienceForLevel()).toBe(100);
      }

      const result5 = Level.create(5);
      expect(result5.success).toBe(true);
      if (result5.success) {
        expect(result5.data.experienceForLevel()).toBe(400);
      }

      const result10 = Level.create(10);
      expect(result10.success).toBe(true);
      if (result10.success) {
        expect(result10.data.experienceForLevel()).toBe(900);
      }
    });
  });

  describe('toString', () => {
    it('should return string representation', () => {
      const result = Level.create(5);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.toString()).toBe('5');
      }
    });
  });

  describe('equals', () => {
    it('should return true for equal levels', () => {
      const result1 = Level.create(5);
      const result2 = Level.create(5);

      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);
      if (result1.success && result2.success) {
        expect(result1.data.equals(result2.data)).toBe(true);
      }
    });

    it('should return false for different levels', () => {
      const result1 = Level.create(5);
      const result2 = Level.create(6);

      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);
      if (result1.success && result2.success) {
        expect(result1.data.equals(result2.data)).toBe(false);
      }
    });
  });
});
