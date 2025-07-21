import { ValidationError } from '@api/shared/errors';
import { describe, expect, it } from 'vitest';
import { CategoryStats } from './CategoryStats';

describe('CategoryStats', () => {
  describe('create', () => {
    it('should create valid category stats', () => {
      const stats = {
        version: 1,
        categories: {
          CCNA: { correct: 8, total: 10, accuracy: 80 },
          CCNP: { correct: 15, total: 20, accuracy: 75 },
        },
      };

      const result = CategoryStats.create(stats);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.stats).toEqual(stats);
      }
    });

    it('should create empty category stats', () => {
      const result = CategoryStats.createEmpty();

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.stats.version).toBe(1);
        expect(result.data.stats.categories).toEqual({});
      }
    });

    it('should fail when version is invalid', () => {
      const stats = {
        version: 0,
        categories: {},
      };

      const result = CategoryStats.create(stats);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(ValidationError);
        expect(result.error.message).toBe('Category stats version must be positive');
      }
    });

    it('should fail when categories is not an object', () => {
      const stats = {
        version: 1,
        categories: 'invalid',
      };

      // Test with invalid data structure
      const result = CategoryStats.create(stats as unknown);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toBe('Categories must be an object');
      }
    });

    it('should fail when category stat is not an object', () => {
      const stats = {
        version: 1,
        categories: {
          CCNA: 'invalid', // Not an object
        },
      };

      const result = CategoryStats.create(stats as unknown);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toBe('Invalid category stat for CCNA');
      }
    });

    it('should fail when category stat has invalid properties', () => {
      const stats = {
        version: 1,
        categories: {
          CCNA: {
            correct: 'not a number', // Should be number
            total: 10,
            accuracy: 80,
          },
        },
      };

      const result = CategoryStats.create(stats as unknown);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toBe('Invalid stat properties for category CCNA');
      }
    });

    it('should fail when category stat has negative values', () => {
      const stats = {
        version: 1,
        categories: {
          CCNA: {
            correct: -5, // Negative value
            total: 10,
            accuracy: 80,
          },
        },
      };

      const result = CategoryStats.create(stats);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toContain('Invalid stat values for category CCNA');
      }
    });

    it('should fail when accuracy is greater than 100', () => {
      const stats = {
        version: 1,
        categories: {
          CCNA: {
            correct: 10,
            total: 10,
            accuracy: 150, // Greater than 100
          },
        },
      };

      const result = CategoryStats.create(stats);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toContain('Invalid stat values for category CCNA');
      }
    });
  });

  describe('updateCategory', () => {
    it('should update existing category stats', () => {
      const result = CategoryStats.createEmpty();
      if (!result.success) throw new Error('Failed to create');
      const initial = result.data;
      const updated = initial.updateCategory('CCNA', 8, 10);

      const ccnaStats = updated.getCategoryStats('CCNA');
      expect(ccnaStats).toEqual({
        correct: 8,
        total: 10,
        accuracy: 80,
      });
    });

    it('should add new category stats', () => {
      const result = CategoryStats.createEmpty();
      if (!result.success) throw new Error('Failed to create');
      const initial = result.data;
      const updated = initial.updateCategory('Security+', 15, 20);

      const secStats = updated.getCategoryStats('Security+');
      expect(secStats).toEqual({
        correct: 15,
        total: 20,
        accuracy: 75,
      });
    });

    it('should handle perfect accuracy', () => {
      const result = CategoryStats.createEmpty();
      if (!result.success) throw new Error('Failed to create');
      const initial = result.data;
      const updated = initial.updateCategory('CCNA', 10, 10);

      const ccnaStats = updated.getCategoryStats('CCNA');
      expect(ccnaStats?.accuracy).toBe(100);
    });

    it('should handle zero total questions', () => {
      const result = CategoryStats.createEmpty();
      if (!result.success) throw new Error('Failed to create');
      const initial = result.data;
      const updated = initial.updateCategory('CCNA', 0, 0);

      const ccnaStats = updated.getCategoryStats('CCNA');
      expect(ccnaStats?.accuracy).toBe(0);
    });
  });

  describe('incrementCategory', () => {
    it('should increment existing category with correct answer', () => {
      const result = CategoryStats.createEmpty();
      if (!result.success) throw new Error('Failed to create');
      const initial = result.data.updateCategory('CCNA', 5, 10);

      const updated = initial.incrementCategory('CCNA', true);
      const ccnaStats = updated.getCategoryStats('CCNA');

      expect(ccnaStats).toEqual({
        correct: 6,
        total: 11,
        accuracy: 54.55, // 6/11 rounded to 2 decimal places
      });
    });

    it('should increment existing category with incorrect answer', () => {
      const result = CategoryStats.createEmpty();
      if (!result.success) throw new Error('Failed to create');
      const initial = result.data.updateCategory('CCNA', 5, 10);

      const updated = initial.incrementCategory('CCNA', false);
      const ccnaStats = updated.getCategoryStats('CCNA');

      expect(ccnaStats).toEqual({
        correct: 5,
        total: 11,
        accuracy: 45.45, // 5/11 rounded to 2 decimal places
      });
    });

    it('should create new category with correct answer', () => {
      const result = CategoryStats.createEmpty();
      if (!result.success) throw new Error('Failed to create');
      const initial = result.data;
      const updated = initial.incrementCategory('Security+', true);

      const secStats = updated.getCategoryStats('Security+');
      expect(secStats).toEqual({
        correct: 1,
        total: 1,
        accuracy: 100,
      });
    });

    it('should create new category with incorrect answer', () => {
      const result = CategoryStats.createEmpty();
      if (!result.success) throw new Error('Failed to create');
      const initial = result.data;
      const updated = initial.incrementCategory('Security+', false);

      const secStats = updated.getCategoryStats('Security+');
      expect(secStats).toEqual({
        correct: 0,
        total: 1,
        accuracy: 0,
      });
    });
  });

  describe('getCategoryStats', () => {
    it('should return category stats when exists', () => {
      const result = CategoryStats.createEmpty();
      if (!result.success) throw new Error('Failed to create');
      const initial = result.data.updateCategory('CCNA', 8, 10);

      const stats = initial.getCategoryStats('CCNA');
      expect(stats).toEqual({
        correct: 8,
        total: 10,
        accuracy: 80,
      });
    });

    it('should return undefined when category does not exist', () => {
      const result = CategoryStats.createEmpty();
      if (!result.success) throw new Error('Failed to create');
      const initial = result.data;
      const stats = initial.getCategoryStats('NonExistent');

      expect(stats).toBeUndefined();
    });
  });

  describe('getAllCategories', () => {
    it('should return all category names', () => {
      const result = CategoryStats.createEmpty();
      if (!result.success) throw new Error('Failed to create');
      const initial = result.data.updateCategory('CCNA', 8, 10).updateCategory('Security+', 15, 20);

      const categories = initial.getAllCategories();
      expect(categories).toEqual(['CCNA', 'Security+']);
    });

    it('should return empty array for no categories', () => {
      const result = CategoryStats.createEmpty();
      if (!result.success) throw new Error('Failed to create');
      const initial = result.data;
      const categories = initial.getAllCategories();

      expect(categories).toEqual([]);
    });
  });

  describe('toString', () => {
    it('should return JSON string representation', () => {
      const result = CategoryStats.createEmpty();
      if (!result.success) throw new Error('Failed to create');
      const stats = result.data.updateCategory('CCNA', 8, 10);

      const jsonString = stats.toString();
      const parsed = JSON.parse(jsonString);

      expect(parsed.version).toBe(1);
      expect(parsed.categories.CCNA).toEqual({
        correct: 8,
        total: 10,
        accuracy: 80,
      });
    });
  });

  describe('equals', () => {
    it('should return true for equal category stats', () => {
      const result1 = CategoryStats.createEmpty();
      if (!result1.success) throw new Error('Failed to create');
      const stats1 = result1.data.updateCategory('CCNA', 8, 10);
      const result2 = CategoryStats.createEmpty();
      if (!result2.success) throw new Error('Failed to create');
      const stats2 = result2.data.updateCategory('CCNA', 8, 10);

      expect(stats1.equals(stats2)).toBe(true);
    });

    it('should return false for different category stats', () => {
      const result1 = CategoryStats.createEmpty();
      if (!result1.success) throw new Error('Failed to create');
      const stats1 = result1.data.updateCategory('CCNA', 8, 10);
      const result2 = CategoryStats.createEmpty();
      if (!result2.success) throw new Error('Failed to create');
      const stats2 = result2.data.updateCategory('CCNA', 9, 10);

      expect(stats1.equals(stats2)).toBe(false);
    });
  });
});
