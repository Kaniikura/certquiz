import { ValidationError } from '@api/shared/errors';
import { describe, expect, it } from 'vitest';
import { StudyTime } from './StudyTime';

describe('StudyTime', () => {
  describe('create', () => {
    it('should create valid study time', () => {
      const result = StudyTime.create(120);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.minutes).toBe(120);
      }
    });

    it('should create study time with 0 minutes', () => {
      const result = StudyTime.create(0);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.minutes).toBe(0);
      }
    });

    it('should fail when minutes is negative', () => {
      const result = StudyTime.create(-1);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(ValidationError);
        expect(result.error.message).toBe('Study time cannot be negative');
      }
    });

    it('should fail when minutes is not an integer', () => {
      const result = StudyTime.create(30.5);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(ValidationError);
        expect(result.error.message).toBe('Study time must be in whole minutes');
      }
    });
  });

  describe('fromHours', () => {
    it('should create from hours', () => {
      const studyTime = StudyTime.fromHours(2.5);
      expect(studyTime.minutes).toBe(150);
    });

    it('should round fractional minutes', () => {
      const studyTime = StudyTime.fromHours(1.999); // 119.94 minutes
      expect(studyTime.minutes).toBe(120);
    });
  });

  describe('addMinutes', () => {
    it('should add study minutes', () => {
      const createResult = StudyTime.create(60);
      if (!createResult.success) throw new Error('Failed to create');
      const time = createResult.data;
      const result = time.addMinutes(30);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.minutes).toBe(90);
      }
    });

    it('should not add negative minutes', () => {
      const createResult = StudyTime.create(60);
      if (!createResult.success) throw new Error('Failed to create');
      const time = createResult.data;
      const result = time.addMinutes(-30);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toBe('Cannot add negative study time');
      }
    });
  });

  describe('toHours', () => {
    it('should convert minutes to hours', () => {
      const result = StudyTime.create(150);
      if (!result.success) throw new Error('Failed to create');
      const time = result.data;
      expect(time.toHours()).toBe(2.5);
    });

    it('should handle zero minutes', () => {
      const result = StudyTime.create(0);
      if (!result.success) throw new Error('Failed to create');
      const time = result.data;
      expect(time.toHours()).toBe(0);
    });

    it('should round to 2 decimal places', () => {
      const result = StudyTime.create(125);
      if (!result.success) throw new Error('Failed to create');
      const time = result.data; // 2.083333...
      expect(time.toHours()).toBe(2.08);
    });
  });

  describe('formatDuration', () => {
    it('should format as hours and minutes', () => {
      const result = StudyTime.create(150);
      if (!result.success) throw new Error('Failed to create');
      const time = result.data;
      expect(time.formatDuration()).toBe('2h 30m');
    });

    it('should format hours only when no minutes', () => {
      const result = StudyTime.create(120);
      if (!result.success) throw new Error('Failed to create');
      const time = result.data;
      expect(time.formatDuration()).toBe('2h');
    });

    it('should format minutes only when less than an hour', () => {
      const result = StudyTime.create(45);
      if (!result.success) throw new Error('Failed to create');
      const time = result.data;
      expect(time.formatDuration()).toBe('45m');
    });

    it('should return 0m for zero time', () => {
      const result = StudyTime.create(0);
      if (!result.success) throw new Error('Failed to create');
      const time = result.data;
      expect(time.formatDuration()).toBe('0m');
    });
  });

  describe('toString', () => {
    it('should return string representation', () => {
      const result = StudyTime.create(90);
      if (!result.success) throw new Error('Failed to create');
      const time = result.data;
      expect(time.toString()).toBe('90');
    });
  });

  describe('equals', () => {
    it('should return true for equal study time', () => {
      const result1 = StudyTime.create(120);
      if (!result1.success) throw new Error('Failed to create');
      const time1 = result1.data;
      const result2 = StudyTime.create(120);
      if (!result2.success) throw new Error('Failed to create');
      const time2 = result2.data;

      expect(time1.equals(time2)).toBe(true);
    });

    it('should return false for different study time', () => {
      const result1 = StudyTime.create(120);
      if (!result1.success) throw new Error('Failed to create');
      const time1 = result1.data;
      const result2 = StudyTime.create(150);
      if (!result2.success) throw new Error('Failed to create');
      const time2 = result2.data;

      expect(time1.equals(time2)).toBe(false);
    });
  });
});
