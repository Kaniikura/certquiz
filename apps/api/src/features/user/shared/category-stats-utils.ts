/**
 * Shared utilities for category statistics
 * @fileoverview Common functions for working with CategoryStats value objects
 */

import type { UserProgress } from '../domain/entities/UserProgress';

interface CategoryStatsDTO {
  [category: string]: {
    correct: number;
    total: number;
    accuracy: number;
  };
}

/**
 * Extract category statistics from UserProgress to DTO format
 * @param userProgress - UserProgress entity containing category stats
 * @returns CategoryStatsDTO object with stats for each category
 */
export function extractCategoryStats(userProgress: UserProgress): CategoryStatsDTO {
  const categoryStats: CategoryStatsDTO = {};

  for (const cat of userProgress.categoryStats.getAllCategories()) {
    const stats = userProgress.categoryStats.getCategoryStats(cat);
    if (stats) {
      categoryStats[cat] = stats;
    }
  }

  return categoryStats;
}
