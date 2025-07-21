import { ValidationError } from '@api/shared/errors';
import { describe, expect, it } from 'vitest';
import { Accuracy } from './Accuracy';

describe('Accuracy', () => {
  describe('create', () => {
    it('should create valid accuracy percentage', () => {
      const result = Accuracy.create(85.5);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.value).toBe(85.5);
      }
    });

    it('should create 0% accuracy', () => {
      const result = Accuracy.create(0);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.value).toBe(0);
      }
    });

    it('should create 100% accuracy', () => {
      const result = Accuracy.create(100);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.value).toBe(100);
      }
    });

    it('should fail when accuracy is negative', () => {
      const result = Accuracy.create(-1);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(ValidationError);
        expect(result.error.message).toBe('Accuracy must be between 0 and 100');
      }
    });

    it('should fail when accuracy exceeds 100', () => {
      const result = Accuracy.create(100.1);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(ValidationError);
        expect(result.error.message).toBe('Accuracy must be between 0 and 100');
      }
    });

    it('should round to 2 decimal places', () => {
      const result = Accuracy.create(85.55555);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.value).toBe(85.56);
      }
    });
  });

  describe('fromQuizResults', () => {
    it('should calculate accuracy from quiz results', () => {
      const accuracy = Accuracy.fromQuizResults(8, 10);
      expect(accuracy.value).toBe(80);
    });

    it('should handle zero total questions', () => {
      const accuracy = Accuracy.fromQuizResults(0, 0);
      expect(accuracy.value).toBe(0);
    });

    it('should calculate 100% accuracy', () => {
      const accuracy = Accuracy.fromQuizResults(10, 10);
      expect(accuracy.value).toBe(100);
    });

    it('should round to 2 decimal places', () => {
      const accuracy = Accuracy.fromQuizResults(2, 3); // 66.6666...
      expect(accuracy.value).toBe(66.67);
    });
  });

  describe('recalculate', () => {
    it('should recalculate accuracy with new quiz results', () => {
      const result = Accuracy.create(80);
      if (!result.success) throw new Error('Failed to create');
      const initial = result.data; // 80 correct out of 100
      const updated = initial.recalculate(80, 100, 10, 10); // Add 10 correct out of 10

      expect(updated.value).toBe(81.82); // 90/110 = 81.818...
    });

    it('should handle first quiz results', () => {
      const result = Accuracy.create(0);
      if (!result.success) throw new Error('Failed to create');
      const initial = result.data;
      const updated = initial.recalculate(0, 0, 8, 10);

      expect(updated.value).toBe(80); // 8/10 = 80%
    });

    it('should maintain accuracy when adding perfect results', () => {
      const result = Accuracy.create(100);
      if (!result.success) throw new Error('Failed to create');
      const initial = result.data; // 10 correct out of 10
      const updated = initial.recalculate(10, 10, 5, 5); // Add 5 correct out of 5

      expect(updated.value).toBe(100); // 15/15 = 100%
    });
  });

  describe('getGrade', () => {
    it('should return A for 90%+', () => {
      const result = Accuracy.create(95);
      if (!result.success) throw new Error('Failed to create');
      const accuracy = result.data;
      expect(accuracy.getGrade()).toBe('A');
    });

    it('should return B for 80-89%', () => {
      const result = Accuracy.create(85);
      if (!result.success) throw new Error('Failed to create');
      const accuracy = result.data;
      expect(accuracy.getGrade()).toBe('B');
    });

    it('should return C for 70-79%', () => {
      const result = Accuracy.create(75);
      if (!result.success) throw new Error('Failed to create');
      const accuracy = result.data;
      expect(accuracy.getGrade()).toBe('C');
    });

    it('should return D for 60-69%', () => {
      const result = Accuracy.create(65);
      if (!result.success) throw new Error('Failed to create');
      const accuracy = result.data;
      expect(accuracy.getGrade()).toBe('D');
    });

    it('should return F for below 60%', () => {
      const result = Accuracy.create(50);
      if (!result.success) throw new Error('Failed to create');
      const accuracy = result.data;
      expect(accuracy.getGrade()).toBe('F');
    });
  });

  describe('toString', () => {
    it('should return percentage string', () => {
      const result = Accuracy.create(85.5);
      if (!result.success) throw new Error('Failed to create');
      const accuracy = result.data;
      expect(accuracy.toString()).toBe('85.50%');
    });

    it('should handle whole numbers', () => {
      const result = Accuracy.create(90);
      if (!result.success) throw new Error('Failed to create');
      const accuracy = result.data;
      expect(accuracy.toString()).toBe('90.00%');
    });
  });

  describe('equals', () => {
    it('should return true for equal accuracy', () => {
      const result1 = Accuracy.create(85.5);
      if (!result1.success) throw new Error('Failed to create');
      const acc1 = result1.data;
      const result2 = Accuracy.create(85.5);
      if (!result2.success) throw new Error('Failed to create');
      const acc2 = result2.data;

      expect(acc1.equals(acc2)).toBe(true);
    });

    it('should return false for different accuracy', () => {
      const result1 = Accuracy.create(85.5);
      if (!result1.success) throw new Error('Failed to create');
      const acc1 = result1.data;
      const result2 = Accuracy.create(85.6);
      if (!result2.success) throw new Error('Failed to create');
      const acc2 = result2.data;

      expect(acc1.equals(acc2)).toBe(false);
    });
  });
});
