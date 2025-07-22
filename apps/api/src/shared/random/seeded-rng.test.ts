/**
 * Seeded RNG utilities tests
 * @fileoverview Unit tests for deterministic random number generation
 */

import { describe, expect, it, vi } from 'vitest';
import {
  createSeededRNG,
  generateCryptoSeed,
  randomChoice,
  randomIntInRange,
  shuffleWithSeed,
} from './seeded-rng';

describe('createSeededRNG', () => {
  describe('deterministic behavior', () => {
    it('should produce same sequence for same seed', () => {
      const seed = 12345;
      const rng1 = createSeededRNG(seed);
      const rng2 = createSeededRNG(seed);

      // Generate several numbers and verify they match
      for (let i = 0; i < 10; i++) {
        expect(rng1.next()).toBe(rng2.next());
      }
    });

    it('should produce different sequences for different seeds', () => {
      const rng1 = createSeededRNG(12345);
      const rng2 = createSeededRNG(54321);

      const sequence1 = Array.from({ length: 5 }, () => rng1.next());
      const sequence2 = Array.from({ length: 5 }, () => rng2.next());

      expect(sequence1).not.toEqual(sequence2);
    });

    it('should reset to initial state', () => {
      const rng = createSeededRNG(12345);

      const firstValue = rng.next();
      const secondValue = rng.next();

      rng.reset();

      expect(rng.next()).toBe(firstValue);
      expect(rng.next()).toBe(secondValue);
    });
  });

  describe('seed handling', () => {
    it('should handle positive integer seeds', () => {
      const rng = createSeededRNG(42);
      expect(rng.getSeed()).toBe(42);
    });

    it('should handle negative seeds by making them positive', () => {
      const rng = createSeededRNG(-42);
      expect(rng.getSeed()).toBe(42);
    });

    it('should handle zero seed by using 1', () => {
      const rng = createSeededRNG(0);
      expect(rng.getSeed()).toBe(1);
    });

    it('should handle decimal seeds by flooring them', () => {
      const rng = createSeededRNG(42.7);
      expect(rng.getSeed()).toBe(42);
    });
  });

  describe('random number properties', () => {
    it('should generate numbers in [0, 1) range', () => {
      const rng = createSeededRNG(12345);

      for (let i = 0; i < 100; i++) {
        const value = rng.next();
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThan(1);
      }
    });

    it('should generate well-distributed numbers', () => {
      const rng = createSeededRNG(12345);
      const samples = 10000;
      const buckets = 10;
      const counts = new Array(buckets).fill(0);

      // Collect samples into buckets
      for (let i = 0; i < samples; i++) {
        const value = rng.next();
        const bucket = Math.floor(value * buckets);
        counts[bucket]++;
      }

      // Check that distribution is reasonably uniform
      // Allow 20% deviation from expected count
      const expectedCount = samples / buckets;
      const tolerance = expectedCount * 0.2;

      for (const count of counts) {
        expect(count).toBeGreaterThan(expectedCount - tolerance);
        expect(count).toBeLessThan(expectedCount + tolerance);
      }
    });
  });
});

describe('generateCryptoSeed', () => {
  it('should return a positive number', () => {
    const seed = generateCryptoSeed();
    expect(typeof seed).toBe('number');
    expect(seed).toBeGreaterThan(0);
  });

  it('should generate different seeds on multiple calls', () => {
    const seeds = Array.from({ length: 10 }, () => generateCryptoSeed());
    const uniqueSeeds = new Set(seeds);

    // Should have high probability of all being unique
    expect(uniqueSeeds.size).toBeGreaterThan(8);
  });
});

describe('shuffleWithSeed', () => {
  const testArray = ['A', 'B', 'C', 'D', 'E'];

  it('should produce deterministic shuffle with seed', () => {
    const seed = 12345;
    const shuffle1 = shuffleWithSeed(testArray, seed);
    const shuffle2 = shuffleWithSeed(testArray, seed);

    expect(shuffle1).toEqual(shuffle2);
  });

  it('should produce different shuffles with different seeds', () => {
    const shuffle1 = shuffleWithSeed(testArray, 12345);
    const shuffle2 = shuffleWithSeed(testArray, 54321);

    expect(shuffle1).not.toEqual(shuffle2);
  });

  it('should contain all original elements', () => {
    const shuffled = shuffleWithSeed(testArray, 12345);

    expect(shuffled).toHaveLength(testArray.length);
    for (const element of testArray) {
      expect(shuffled).toContain(element);
    }
  });

  it('should not modify original array', () => {
    const original = [...testArray];
    shuffleWithSeed(testArray, 12345);

    expect(testArray).toEqual(original);
  });

  it('should handle empty array', () => {
    const result = shuffleWithSeed([], 12345);
    expect(result).toEqual([]);
  });

  it('should handle single element array', () => {
    const singleElement = ['A'];
    const result = shuffleWithSeed(singleElement, 12345);
    expect(result).toEqual(['A']);
  });

  it('should produce random shuffle without seed', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5);

    const _result = shuffleWithSeed(testArray);

    expect(Math.random).toHaveBeenCalled();
    vi.restoreAllMocks();
  });
});

describe('randomIntInRange', () => {
  it('should generate integers in specified range', () => {
    const rng = createSeededRNG(12345);
    const min = 1;
    const max = 10;

    for (let i = 0; i < 50; i++) {
      const value = randomIntInRange(min, max, rng);
      expect(value).toBeGreaterThanOrEqual(min);
      expect(value).toBeLessThanOrEqual(max);
      expect(Number.isInteger(value)).toBe(true);
    }
  });

  it('should be deterministic with seeded RNG', () => {
    const rng1 = createSeededRNG(12345);
    const rng2 = createSeededRNG(12345);

    for (let i = 0; i < 10; i++) {
      const value1 = randomIntInRange(1, 100, rng1);
      const value2 = randomIntInRange(1, 100, rng2);
      expect(value1).toBe(value2);
    }
  });

  it('should handle single value range', () => {
    const rng = createSeededRNG(12345);
    const value = randomIntInRange(5, 5, rng);
    expect(value).toBe(5);
  });

  it('should distribute values across range', () => {
    const rng = createSeededRNG(12345);
    const min = 1;
    const max = 5;
    const counts = new Map<number, number>();

    // Generate many samples
    for (let i = 0; i < 1000; i++) {
      const value = randomIntInRange(min, max, rng);
      counts.set(value, (counts.get(value) || 0) + 1);
    }

    // Should hit all values in range
    for (let i = min; i <= max; i++) {
      expect(counts.get(i)).toBeGreaterThan(0);
    }
  });
});

describe('randomChoice', () => {
  const testArray = ['A', 'B', 'C', 'D', 'E'];

  it('should choose element from array', () => {
    const rng = createSeededRNG(12345);
    const choice = randomChoice(testArray, rng);

    expect(testArray).toContain(choice);
  });

  it('should be deterministic with seeded RNG', () => {
    const rng1 = createSeededRNG(12345);
    const rng2 = createSeededRNG(12345);

    for (let i = 0; i < 10; i++) {
      const choice1 = randomChoice(testArray, rng1);
      const choice2 = randomChoice(testArray, rng2);
      expect(choice1).toBe(choice2);
    }
  });

  it('should return undefined for empty array', () => {
    const rng = createSeededRNG(12345);
    const choice = randomChoice([], rng);

    expect(choice).toBeUndefined();
  });

  it('should return single element for single-element array', () => {
    const rng = createSeededRNG(12345);
    const singleElement = ['A'];
    const choice = randomChoice(singleElement, rng);

    expect(choice).toBe('A');
  });

  it('should choose all elements over many iterations', () => {
    const rng = createSeededRNG(12345);
    const chosen = new Set<string>();

    // Run many iterations to hit all elements
    for (let i = 0; i < 100; i++) {
      const choice = randomChoice(testArray, rng);
      if (choice !== undefined) {
        chosen.add(choice);
      }
    }

    // Should have chosen all elements eventually
    expect(chosen.size).toBe(testArray.length);
  });
});
