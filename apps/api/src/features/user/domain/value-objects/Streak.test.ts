import { ValidationError } from '@api/shared/errors';
import { describe, expect, it } from 'vitest';
import { Streak } from './Streak';

describe('Streak', () => {
  describe('create', () => {
    it('should create valid streak', () => {
      const result = Streak.create(5);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.days).toBe(5);
      }
    });

    it('should create streak with 0 days', () => {
      const result = Streak.create(0);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.days).toBe(0);
      }
    });

    it('should fail when days is negative', () => {
      const result = Streak.create(-1);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(ValidationError);
        expect(result.error.message).toBe('Streak days cannot be negative');
      }
    });

    it('should fail when days is not an integer', () => {
      const result = Streak.create(5.5);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(ValidationError);
        expect(result.error.message).toBe('Streak days must be a whole number');
      }
    });
  });

  describe('increment', () => {
    it('should increment streak by one day', () => {
      const result = Streak.create(5);
      if (!result.success) throw new Error('Failed to create');
      const streak = result.data;
      const newStreak = streak.increment();

      expect(newStreak.days).toBe(6);
    });

    it('should increment from zero', () => {
      const result = Streak.create(0);
      if (!result.success) throw new Error('Failed to create');
      const streak = result.data;
      const newStreak = streak.increment();

      expect(newStreak.days).toBe(1);
    });
  });

  describe('reset', () => {
    it('should reset streak to zero', () => {
      const result = Streak.create(10);
      if (!result.success) throw new Error('Failed to create');
      const streak = result.data;
      const newStreak = streak.reset();

      expect(newStreak.days).toBe(0);
    });

    it('should reset already zero streak', () => {
      const result = Streak.create(0);
      if (!result.success) throw new Error('Failed to create');
      const streak = result.data;
      const newStreak = streak.reset();

      expect(newStreak.days).toBe(0);
    });
  });

  describe('isActive', () => {
    it('should return true for active streak', () => {
      const result = Streak.create(5);
      if (!result.success) throw new Error('Failed to create');
      const streak = result.data;
      expect(streak.isActive()).toBe(true);
    });

    it('should return false for zero streak', () => {
      const result = Streak.create(0);
      if (!result.success) throw new Error('Failed to create');
      const streak = result.data;
      expect(streak.isActive()).toBe(false);
    });
  });

  describe('getStreakLevel', () => {
    it('should return beginner level', () => {
      const result = Streak.create(3);
      if (!result.success) throw new Error('Failed to create');
      const streak = result.data;
      expect(streak.getStreakLevel()).toBe('beginner');
    });

    it('should return regular level', () => {
      const result = Streak.create(10);
      if (!result.success) throw new Error('Failed to create');
      const streak = result.data;
      expect(streak.getStreakLevel()).toBe('regular');
    });

    it('should return dedicated level', () => {
      const result = Streak.create(25);
      if (!result.success) throw new Error('Failed to create');
      const streak = result.data;
      expect(streak.getStreakLevel()).toBe('dedicated');
    });

    it('should return champion level', () => {
      const result = Streak.create(60);
      if (!result.success) throw new Error('Failed to create');
      const streak = result.data;
      expect(streak.getStreakLevel()).toBe('champion');
    });

    it('should return legend level', () => {
      const result = Streak.create(150);
      if (!result.success) throw new Error('Failed to create');
      const streak = result.data;
      expect(streak.getStreakLevel()).toBe('legend');
    });

    it('should return none for zero streak', () => {
      const result = Streak.create(0);
      if (!result.success) throw new Error('Failed to create');
      const streak = result.data;
      expect(streak.getStreakLevel()).toBe('none');
    });
  });

  describe('toString', () => {
    it('should return string representation', () => {
      const result = Streak.create(7);
      if (!result.success) throw new Error('Failed to create');
      const streak = result.data;
      expect(streak.toString()).toBe('7');
    });
  });

  describe('equals', () => {
    it('should return true for equal streaks', () => {
      const result1 = Streak.create(5);
      if (!result1.success) throw new Error('Failed to create');
      const streak1 = result1.data;
      const result2 = Streak.create(5);
      if (!result2.success) throw new Error('Failed to create');
      const streak2 = result2.data;

      expect(streak1.equals(streak2)).toBe(true);
    });

    it('should return false for different streaks', () => {
      const result1 = Streak.create(5);
      if (!result1.success) throw new Error('Failed to create');
      const streak1 = result1.data;
      const result2 = Streak.create(6);
      if (!result2.success) throw new Error('Failed to create');
      const streak2 = result2.data;

      expect(streak1.equals(streak2)).toBe(false);
    });
  });
});
