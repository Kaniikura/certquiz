/**
 * List questions validation tests
 * @fileoverview Tests for the listQuestionsSchema including flexible boolean parsing
 */

import { describe, expect, it } from 'vitest';
import { listQuestionsSchema } from './validation';

describe('listQuestionsSchema - Flexible Boolean Parsing', () => {
  describe('includePremium parsing', () => {
    it('should parse true values (case-insensitive)', () => {
      const trueValues = ['true', 'TRUE', 'True', '1', 'yes', 'YES', 'Yes'];

      for (const value of trueValues) {
        const result = listQuestionsSchema.safeParse({ includePremium: value });
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.includePremium).toBe(true);
        }
      }
    });

    it('should parse false values', () => {
      const falseValues = [
        'false',
        'FALSE',
        'False',
        '0',
        'no',
        'NO',
        'No',
        'invalid',
        '',
        'null',
        'undefined',
      ];

      for (const value of falseValues) {
        const result = listQuestionsSchema.safeParse({ includePremium: value });
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.includePremium).toBe(false);
        }
      }
    });

    it('should handle values with whitespace', () => {
      const whitespaceValues = [
        { input: '  true  ', expected: true },
        { input: '\ttrue\t', expected: true },
        { input: '  1  ', expected: true },
        { input: '  yes  ', expected: true },
        { input: '  false  ', expected: false },
        { input: '  no  ', expected: false },
      ];

      for (const { input, expected } of whitespaceValues) {
        const result = listQuestionsSchema.safeParse({ includePremium: input });
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.includePremium).toBe(expected);
        }
      }
    });

    it('should use default value when not provided', () => {
      const result = listQuestionsSchema.safeParse({});
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.includePremium).toBe(false); // default 'false' parsed as false
      }
    });
  });

  describe('activeOnly parsing', () => {
    it('should parse true values (case-insensitive)', () => {
      const trueValues = ['true', 'TRUE', 'True', '1', 'yes', 'YES', 'Yes'];

      for (const value of trueValues) {
        const result = listQuestionsSchema.safeParse({ activeOnly: value });
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.activeOnly).toBe(true);
        }
      }
    });

    it('should parse false values', () => {
      const falseValues = [
        'false',
        'FALSE',
        'False',
        '0',
        'no',
        'NO',
        'No',
        'invalid',
        '',
        'null',
        'undefined',
      ];

      for (const value of falseValues) {
        const result = listQuestionsSchema.safeParse({ activeOnly: value });
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.activeOnly).toBe(false);
        }
      }
    });

    it('should use default value when not provided', () => {
      const result = listQuestionsSchema.safeParse({});
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.activeOnly).toBe(true); // default 'true' parsed as true
      }
    });
  });

  describe('URL query parameter examples', () => {
    it('should handle typical API usage patterns', () => {
      const testCases = [
        {
          query: { includePremium: 'true', activeOnly: 'false' },
          expected: { includePremium: true, activeOnly: false },
        },
        {
          query: { includePremium: '1', activeOnly: 'yes' },
          expected: { includePremium: true, activeOnly: true },
        },
        {
          query: { includePremium: 'YES', activeOnly: 'NO' },
          expected: { includePremium: true, activeOnly: false },
        },
        {
          query: { includePremium: '0', activeOnly: '1' },
          expected: { includePremium: false, activeOnly: true },
        },
      ];

      for (const { query, expected } of testCases) {
        const result = listQuestionsSchema.safeParse(query);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.includePremium).toBe(expected.includePremium);
          expect(result.data.activeOnly).toBe(expected.activeOnly);
        }
      }
    });
  });
});
