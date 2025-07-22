/**
 * Query parameter parsing utilities tests
 * @fileoverview Unit tests for shared query parameter parsing functions
 */

import { describe, expect, it } from 'vitest';
import { parseCommaSeparated, parseFlexibleBoolean, parseNumericWithBounds } from './query-params';

describe('parseFlexibleBoolean', () => {
  describe('truthy values', () => {
    it('should parse true values (case-insensitive)', () => {
      const trueValues = ['true', 'TRUE', 'True', '1', 'yes', 'YES', 'Yes'];

      for (const value of trueValues) {
        expect(parseFlexibleBoolean(value)).toBe(true);
      }
    });

    it('should handle whitespace in true values', () => {
      expect(parseFlexibleBoolean(' true ')).toBe(true);
      expect(parseFlexibleBoolean('  1  ')).toBe(true);
      expect(parseFlexibleBoolean('\tyes\t')).toBe(true);
    });
  });

  describe('falsy values', () => {
    it('should parse false values', () => {
      const falseValues = ['false', 'FALSE', '0', 'no', 'NO', '', 'invalid', 'null'];

      for (const value of falseValues) {
        expect(parseFlexibleBoolean(value)).toBe(false);
      }
    });

    it('should handle whitespace in false values', () => {
      expect(parseFlexibleBoolean(' false ')).toBe(false);
      expect(parseFlexibleBoolean('  0  ')).toBe(false);
      expect(parseFlexibleBoolean(' ')).toBe(false);
    });
  });
});

describe('parseCommaSeparated', () => {
  describe('valid inputs', () => {
    it('should parse comma-separated values', () => {
      expect(parseCommaSeparated('a,b,c')).toEqual(['a', 'b', 'c']);
      expect(parseCommaSeparated('item1,item2')).toEqual(['item1', 'item2']);
      expect(parseCommaSeparated('single')).toEqual(['single']);
    });

    it('should trim whitespace from items', () => {
      expect(parseCommaSeparated('a, b , c')).toEqual(['a', 'b', 'c']);
      expect(parseCommaSeparated(' item1 , item2 ')).toEqual(['item1', 'item2']);
      expect(parseCommaSeparated('  single  ')).toEqual(['single']);
    });

    it('should filter out empty items', () => {
      expect(parseCommaSeparated('a,,c')).toEqual(['a', 'c']);
      expect(parseCommaSeparated('a, ,c')).toEqual(['a', 'c']);
      expect(parseCommaSeparated(',,a,,')).toEqual(['a']);
    });
  });

  describe('empty inputs', () => {
    it('should return undefined for empty or undefined inputs', () => {
      expect(parseCommaSeparated('')).toBeUndefined();
      expect(parseCommaSeparated(undefined)).toBeUndefined();
      expect(parseCommaSeparated(' ')).toBeUndefined();
      expect(parseCommaSeparated(',,,')).toBeUndefined();
      expect(parseCommaSeparated(' , , ')).toBeUndefined();
    });
  });
});

describe('parseNumericWithBounds', () => {
  describe('valid numbers', () => {
    it('should parse valid numbers within bounds', () => {
      expect(parseNumericWithBounds('10', 5, 1, 100)).toBe(10);
      expect(parseNumericWithBounds('1', 5, 1, 100)).toBe(1);
      expect(parseNumericWithBounds('100', 5, 1, 100)).toBe(100);
      expect(parseNumericWithBounds('50', 5, 1, 100)).toBe(50);
    });

    it('should clamp numbers to bounds', () => {
      expect(parseNumericWithBounds('200', 5, 1, 100)).toBe(100); // max
      expect(parseNumericWithBounds('0', 5, 1, 100)).toBe(1); // min
      expect(parseNumericWithBounds('-10', 5, 1, 100)).toBe(1); // min
      expect(parseNumericWithBounds('150', 5, 1, 100)).toBe(100); // max
    });
  });

  describe('invalid numbers', () => {
    it('should return default for invalid input', () => {
      expect(parseNumericWithBounds('abc', 5, 1, 100)).toBe(5);
      expect(parseNumericWithBounds('', 10, 1, 100)).toBe(10);
      expect(parseNumericWithBounds(undefined, 20, 1, 100)).toBe(20);
      expect(parseNumericWithBounds('12.5', 5, 1, 100)).toBe(12); // parseInt truncates
    });
  });

  describe('edge cases', () => {
    it('should handle zero bounds correctly', () => {
      expect(parseNumericWithBounds('5', 10, 0, 100)).toBe(5);
      expect(parseNumericWithBounds('-5', 10, 0, 100)).toBe(0);
    });

    it('should handle negative bounds correctly', () => {
      expect(parseNumericWithBounds('-5', 0, -10, 10)).toBe(-5);
      expect(parseNumericWithBounds('-15', 0, -10, 10)).toBe(-10);
    });
  });
});
