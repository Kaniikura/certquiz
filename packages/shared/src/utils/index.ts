import { randomUUID } from 'node:crypto';

// Result type for error handling
export type Result<T, E = Error> = { success: true; data: T } | { success: false; error: E };

// Create success result
export function ok<T>(data: T): Result<T> {
  return { success: true, data };
}

// Create error result
export function err<E = Error>(error: E): Result<never, E> {
  return { success: false, error };
}

// Type guard for checking if result is success
export function isOk<T, E>(result: Result<T, E>): result is { success: true; data: T } {
  return result.success === true;
}

// Type guard for checking if result is error
export function isErr<T, E>(result: Result<T, E>): result is { success: false; error: E } {
  return result.success === false;
}

// Calculate quiz accuracy
export function calculateAccuracy(correct: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((correct / total) * 100);
}

// Calculate experience points
export function calculateExperience(correct: number, total: number, timeSpent: number): number {
  const basePoints = correct * 10;
  const accuracyBonus = calculateAccuracy(correct, total) >= 80 ? 20 : 0;
  const speedBonus = timeSpent < 60 ? 10 : 0; // Less than 1 minute per question
  return basePoints + accuracyBonus + speedBonus;
}

// Calculate user level from experience
export function calculateLevel(experience: number): number {
  // Level up every 100 experience points
  return Math.floor(experience / 100) + 1;
}

// Shuffle array using Fisher-Yates algorithm
export function shuffle<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

/**
 * Generate a cryptographically secure UUID v4
 * Uses Node.js/Bun native crypto.randomUUID() for production-grade security
 */
export function generateId(): string {
  return randomUUID();
}
