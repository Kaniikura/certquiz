import { ValidationError } from '@api/shared/errors';
import { Result } from '@api/shared/result';

interface CategoryStat {
  correct: number;
  total: number;
  accuracy: number;
}

interface CategoryStatsData {
  version: number;
  categories: Record<string, CategoryStat>;
}

/**
 * CategoryStats value object for managing JSONB category statistics
 */
export class CategoryStats {
  private constructor(public readonly stats: CategoryStatsData) {}

  /**
   * Create CategoryStats from raw data
   */
  static create(data: unknown): Result<CategoryStats, ValidationError> {
    if (typeof data !== 'object' || data === null) {
      return Result.fail(new ValidationError('Category stats must be an object'));
    }

    // biome-ignore lint/suspicious/noExplicitAny: Need to cast unknown to access properties
    const dataObj = data as any;
    if (typeof dataObj.version !== 'number' || dataObj.version <= 0) {
      return Result.fail(new ValidationError('Category stats version must be positive'));
    }

    if (typeof dataObj.categories !== 'object' || dataObj.categories === null) {
      return Result.fail(new ValidationError('Categories must be an object'));
    }

    return Result.ok(new CategoryStats(data as CategoryStatsData));
  }

  /**
   * Create empty CategoryStats
   */
  static createEmpty(): Result<CategoryStats, ValidationError> {
    const emptyStats: CategoryStatsData = {
      version: 1,
      categories: {},
    };
    return Result.ok(new CategoryStats(emptyStats));
  }

  /**
   * Update category statistics
   */
  updateCategory(category: string, correct: number, total: number): CategoryStats {
    const accuracy = total === 0 ? 0 : Math.round((correct / total) * 10000) / 100;

    const newCategories = {
      ...this.stats.categories,
      [category]: {
        correct,
        total,
        accuracy,
      },
    };

    return new CategoryStats({
      ...this.stats,
      categories: newCategories,
    });
  }

  /**
   * Increment category with a new quiz result
   */
  incrementCategory(category: string, isCorrect: boolean): CategoryStats {
    const existing = this.stats.categories[category] || { correct: 0, total: 0, accuracy: 0 };

    return this.updateCategory(
      category,
      existing.correct + (isCorrect ? 1 : 0),
      existing.total + 1
    );
  }

  /**
   * Get statistics for a specific category
   */
  getCategoryStats(category: string): CategoryStat | undefined {
    return this.stats.categories[category];
  }

  /**
   * Get all category names
   */
  getAllCategories(): string[] {
    return Object.keys(this.stats.categories);
  }

  toString(): string {
    return JSON.stringify(this.stats);
  }

  equals(other: CategoryStats): boolean {
    return JSON.stringify(this.stats) === JSON.stringify(other.stats);
  }
}
