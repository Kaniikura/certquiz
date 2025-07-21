import { ValidationError } from '@api/shared/errors';
import { Result } from '@api/shared/result';
import { Accuracy } from './Accuracy';

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

    // Type guard to safely access properties
    const dataObj = data as { version?: unknown; categories?: unknown };

    if (typeof dataObj.version !== 'number' || dataObj.version <= 0) {
      return Result.fail(new ValidationError('Category stats version must be positive'));
    }

    if (typeof dataObj.categories !== 'object' || dataObj.categories === null) {
      return Result.fail(new ValidationError('Categories must be an object'));
    }

    // Delegate category validation to separate method
    const categoriesResult = CategoryStats.validateCategories(
      dataObj.categories as Record<string, unknown>
    );
    if (!categoriesResult.success) {
      return Result.fail(categoriesResult.error);
    }

    const validatedData: CategoryStatsData = {
      version: dataObj.version,
      categories: categoriesResult.data,
    };

    return Result.ok(new CategoryStats(validatedData));
  }

  /**
   * Validate all categories
   * @private
   */
  private static validateCategories(
    categories: Record<string, unknown>
  ): Result<Record<string, CategoryStat>, ValidationError> {
    const validatedCategories: Record<string, CategoryStat> = {};

    for (const [key, value] of Object.entries(categories)) {
      const result = CategoryStats.validateCategoryStat(key, value);
      if (!result.success) {
        return Result.fail(result.error);
      }
      validatedCategories[key] = result.data;
    }

    return Result.ok(validatedCategories);
  }

  /**
   * Validate a single category stat
   * @private
   */
  private static validateCategoryStat(
    key: string,
    value: unknown
  ): Result<CategoryStat, ValidationError> {
    if (typeof value !== 'object' || value === null) {
      return Result.fail(new ValidationError(`Invalid category stat for ${key}`));
    }

    const stat = value as { correct?: unknown; total?: unknown; accuracy?: unknown };
    if (
      typeof stat.correct !== 'number' ||
      typeof stat.total !== 'number' ||
      typeof stat.accuracy !== 'number'
    ) {
      return Result.fail(new ValidationError(`Invalid stat properties for category ${key}`));
    }

    // Validate numeric ranges
    if (stat.correct < 0 || stat.total < 0 || stat.accuracy < 0 || stat.accuracy > 100) {
      return Result.fail(
        new ValidationError(
          `Invalid stat values for category ${key}: values must be non-negative and accuracy must be <= 100`
        )
      );
    }

    return Result.ok({
      correct: stat.correct,
      total: stat.total,
      accuracy: stat.accuracy,
    });
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
    const accuracy = Accuracy.fromQuizResults(correct, total);

    const newCategories = {
      ...this.stats.categories,
      [category]: {
        correct,
        total,
        accuracy: accuracy.value,
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
