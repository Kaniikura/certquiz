/**
 * Seeded Random Number Generator Utilities
 * @fileoverview Provides deterministic pseudo-random number generation for testing and reproducible randomness
 */

import { generateSecureSeed } from '@api/shared/crypto';

/**
 * Seeded Random Number Generator interface
 */
export interface SeededRNG {
  /** Generate next random number in [0, 1) range */
  next(): number;
  /** Get current seed value */
  getSeed(): number;
  /** Reset RNG to initial seed */
  reset(): void;
}

/**
 * Create a seeded pseudo-random number generator
 * Uses Lehmer RNG (Park-Miller) algorithm for deterministic but well-distributed randomness
 *
 * @param seed Initial seed value (must be positive integer)
 * @returns SeededRNG instance with deterministic random generation
 *
 * @example
 * ```typescript
 * const rng = createSeededRNG(12345);
 * const random1 = rng.next(); // Always produces same sequence for same seed
 * const random2 = rng.next();
 *
 * // Reset to start over
 * rng.reset();
 * const sameRandom1 = rng.next(); // Will equal random1
 * ```
 */
export function createSeededRNG(seed: number): SeededRNG {
  // Ensure seed is a positive integer
  const initialSeed = Math.abs(Math.floor(seed)) || 1;
  let currentSeed = initialSeed;

  // Lehmer RNG constants (Park-Miller)
  const a = 16807;
  const m = 2147483647; // 2^31 - 1

  return {
    next(): number {
      currentSeed = (a * currentSeed) % m;
      return currentSeed / m;
    },

    getSeed(): number {
      return currentSeed;
    },

    reset(): void {
      currentSeed = initialSeed;
    },
  };
}

/**
 * Generate a cryptographically secure seed for seeded RNG
 * Uses Web Crypto API for true randomness
 *
 * @returns A secure 32-bit unsigned integer seed suitable for seeded RNG
 *
 * @example
 * ```typescript
 * const seed = generateCryptoSeed();
 * const rng = createSeededRNG(seed);
 * ```
 */
export function generateCryptoSeed(): number {
  return generateSecureSeed();
}

/**
 * Fisher-Yates shuffle algorithm with seeded randomness
 * Provides deterministic shuffling when seed is provided
 *
 * @param array Array to shuffle (will not be modified)
 * @param seed Optional seed for deterministic shuffling
 * @returns New shuffled array
 *
 * @example
 * ```typescript
 * const items = ['A', 'B', 'C', 'D'];
 *
 * // Random shuffle (different each time)
 * const randomShuffle = shuffleWithSeed(items);
 *
 * // Deterministic shuffle (same result for same seed)
 * const deterministicShuffle = shuffleWithSeed(items, 12345);
 * ```
 */
export function shuffleWithSeed<T>(array: readonly T[], seed?: number): T[] {
  const shuffled = [...array];
  const rng = seed !== undefined ? createSeededRNG(seed) : createSeededRNG(generateCryptoSeed());

  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rng.next() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  return shuffled;
}

/**
 * Generate random integer in range [min, max] using seeded RNG
 *
 * @param min Minimum value (inclusive)
 * @param max Maximum value (inclusive)
 * @param rng Seeded RNG instance
 * @returns Random integer in specified range
 *
 * @example
 * ```typescript
 * const rng = createSeededRNG(12345);
 * const randomInt = randomIntInRange(1, 10, rng); // Always same for same seed
 * ```
 */
export function randomIntInRange(min: number, max: number, rng: SeededRNG): number {
  return Math.floor(rng.next() * (max - min + 1)) + min;
}

/**
 * Choose random element from array using seeded RNG
 *
 * @param array Array to choose from
 * @param rng Seeded RNG instance
 * @returns Random element from array, or undefined if array is empty
 *
 * @example
 * ```typescript
 * const rng = createSeededRNG(12345);
 * const items = ['A', 'B', 'C'];
 * const chosen = randomChoice(items, rng); // Always same for same seed
 * ```
 */
export function randomChoice<T>(array: readonly T[], rng: SeededRNG): T | undefined {
  if (array.length === 0) return undefined;
  const index = Math.floor(rng.next() * array.length);
  return array[index];
}
