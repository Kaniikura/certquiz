/**
 * QuestionOptions value object tests
 * @fileoverview Tests for collection of question options with business rules
 */

import { describe, expect, it } from 'vitest';
import { QuestionOption } from './QuestionOption';
import { QuestionOptions } from './QuestionOptions';

describe('QuestionOptions', () => {
  const createOption = (id: string, text: string, isCorrect: boolean) => {
    const result = QuestionOption.create({ id, text, isCorrect });
    if (!result.success) throw new Error('Failed to create option');
    return result.data;
  };

  describe('create', () => {
    it('should create valid options with minimum requirements', () => {
      const options = [
        createOption('123e4567-e89b-12d3-a456-426614174001', 'Option 1', true),
        createOption('123e4567-e89b-12d3-a456-426614174002', 'Option 2', false),
      ];

      const result = QuestionOptions.create(options);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.count).toBe(2);
        expect(result.data.hasCorrectAnswer()).toBe(true);
      }
    });

    it('should fail with less than 2 options', () => {
      const options = [createOption('123e4567-e89b-12d3-a456-426614174001', 'Option 1', true)];

      const result = QuestionOptions.create(options);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toContain('at least 2 options');
      }
    });

    it('should fail with no correct answer', () => {
      const options = [
        createOption('123e4567-e89b-12d3-a456-426614174001', 'Option 1', false),
        createOption('123e4567-e89b-12d3-a456-426614174002', 'Option 2', false),
      ];

      const result = QuestionOptions.create(options);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toContain('at least one correct answer');
      }
    });

    it('should fail with duplicate option IDs', () => {
      const options = [
        createOption('123e4567-e89b-12d3-a456-426614174001', 'Option 1', true),
        createOption('123e4567-e89b-12d3-a456-426614174001', 'Option 2', false),
      ];

      const result = QuestionOptions.create(options);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toContain('Duplicate option IDs');
      }
    });

    it('should fail with duplicate option text', () => {
      const options = [
        createOption('123e4567-e89b-12d3-a456-426614174001', 'Same text', true),
        createOption('123e4567-e89b-12d3-a456-426614174002', 'Same text', false),
      ];

      const result = QuestionOptions.create(options);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toContain('Duplicate option texts');
      }
    });

    it('should handle multiple correct answers', () => {
      const options = [
        createOption('123e4567-e89b-12d3-a456-426614174001', 'Option 1', true),
        createOption('123e4567-e89b-12d3-a456-426614174002', 'Option 2', true),
        createOption('123e4567-e89b-12d3-a456-426614174003', 'Option 3', false),
      ];

      const result = QuestionOptions.create(options);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.getCorrectCount()).toBe(2);
      }
    });

    it('should fail with more than 10 options', () => {
      const options = Array.from({ length: 11 }, (_, i) =>
        createOption(
          `123e4567-e89b-12d3-a456-${i.toString().padStart(12, '0')}`,
          `Option ${i + 1}`,
          i === 0
        )
      );

      const result = QuestionOptions.create(options);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toContain('Maximum 10 options allowed');
      }
    });
  });

  describe('getters', () => {
    const validOptions = [
      createOption('123e4567-e89b-12d3-a456-426614174001', 'Option 1', true),
      createOption('123e4567-e89b-12d3-a456-426614174002', 'Option 2', false),
      createOption('123e4567-e89b-12d3-a456-426614174003', 'Option 3', false),
    ];

    it('should return all options', () => {
      const result = QuestionOptions.create(validOptions);
      expect(result.success).toBe(true);
      if (result.success) {
        const all = result.data.getAll();
        expect(all).toHaveLength(3);
        expect(all[0].text).toBe('Option 1');
      }
    });

    it('should find option by ID', () => {
      const result = QuestionOptions.create(validOptions);
      expect(result.success).toBe(true);
      if (result.success) {
        const option = result.data.findById('123e4567-e89b-12d3-a456-426614174002');
        expect(option?.text).toBe('Option 2');
      }
    });

    it('should return null for non-existent ID', () => {
      const result = QuestionOptions.create(validOptions);
      expect(result.success).toBe(true);
      if (result.success) {
        const option = result.data.findById('non-existent-id');
        expect(option).toBeNull();
      }
    });

    it('should get correct options', () => {
      const result = QuestionOptions.create(validOptions);
      expect(result.success).toBe(true);
      if (result.success) {
        const correct = result.data.getCorrectOptions();
        expect(correct).toHaveLength(1);
        expect(correct[0].text).toBe('Option 1');
      }
    });

    it('should shuffle options randomly without seed', () => {
      const result = QuestionOptions.create(validOptions);
      expect(result.success).toBe(true);
      if (result.success) {
        const shuffled = result.data.shuffle();
        expect(shuffled).toHaveLength(3);
        // Should contain all the same options
        expect(shuffled.map((o: QuestionOption) => o.id).sort()).toEqual(
          validOptions.map((o: QuestionOption) => o.id).sort()
        );
      }
    });

    it('should shuffle options deterministically with same seed', () => {
      const result = QuestionOptions.create(validOptions);
      expect(result.success).toBe(true);
      if (result.success) {
        const seed = 12345;
        const shuffled1 = result.data.shuffle(seed);
        const shuffled2 = result.data.shuffle(seed);

        // Same seed should produce identical order
        expect(shuffled1.map((o: QuestionOption) => o.id)).toEqual(
          shuffled2.map((o: QuestionOption) => o.id)
        );
        expect(shuffled1).toHaveLength(3);
        expect(shuffled2).toHaveLength(3);
      }
    });

    it('should shuffle options differently with different seeds', () => {
      const result = QuestionOptions.create(validOptions);
      expect(result.success).toBe(true);
      if (result.success) {
        const shuffled1 = result.data.shuffle(11111);
        const shuffled2 = result.data.shuffle(22222);

        // Different seeds should likely produce different orders
        // (This could theoretically fail but probability is very low)
        const order1 = shuffled1.map((o: QuestionOption) => o.id).join(',');
        const order2 = shuffled2.map((o: QuestionOption) => o.id).join(',');
        expect(order1).not.toBe(order2);
      }
    });

    it('should handle edge case seeds correctly', () => {
      const result = QuestionOptions.create(validOptions);
      expect(result.success).toBe(true);
      if (result.success) {
        // Test edge cases
        const shuffledZero = result.data.shuffle(0);
        const shuffledNegative = result.data.shuffle(-123);
        const shuffledFloat = result.data.shuffle(123.456);

        expect(shuffledZero).toHaveLength(3);
        expect(shuffledNegative).toHaveLength(3);
        expect(shuffledFloat).toHaveLength(3);

        // All should contain the same options
        [shuffledZero, shuffledNegative, shuffledFloat].forEach((shuffled) => {
          expect(shuffled.map((o: QuestionOption) => o.id).sort()).toEqual(
            validOptions.map((o: QuestionOption) => o.id).sort()
          );
        });
      }
    });
  });

  describe('secure seed generation', () => {
    it('should generate different seeds on each call', () => {
      const seed1 = QuestionOptions.generateSecureSeed();
      const seed2 = QuestionOptions.generateSecureSeed();
      const seed3 = QuestionOptions.generateSecureSeed();

      // Seeds should be different (very high probability)
      expect(seed1).not.toBe(seed2);
      expect(seed1).not.toBe(seed3);
      expect(seed2).not.toBe(seed3);
    });

    it('should generate seeds within valid range', () => {
      for (let i = 0; i < 10; i++) {
        const seed = QuestionOptions.generateSecureSeed();
        expect(seed).toBeGreaterThanOrEqual(0);
        expect(seed).toBeLessThanOrEqual(0xffffffff); // 32-bit unsigned max
        expect(Number.isInteger(seed)).toBe(true);
      }
    });

    it('should produce reproducible shuffles when used as seeds', () => {
      const validOptions = [
        createOption('123e4567-e89b-12d3-a456-426614174001', 'Option 1', true),
        createOption('123e4567-e89b-12d3-a456-426614174002', 'Option 2', false),
        createOption('123e4567-e89b-12d3-a456-426614174003', 'Option 3', false),
        createOption('123e4567-e89b-12d3-a456-426614174004', 'Option 4', false),
        createOption('123e4567-e89b-12d3-a456-426614174005', 'Option 5', false),
      ];

      const result = QuestionOptions.create(validOptions);
      expect(result.success).toBe(true);

      if (result.success) {
        const seed = QuestionOptions.generateSecureSeed();
        const shuffled1 = result.data.shuffle(seed);
        const shuffled2 = result.data.shuffle(seed);

        // Same generated seed should produce identical shuffles
        expect(shuffled1.map((o: QuestionOption) => o.id)).toEqual(
          shuffled2.map((o: QuestionOption) => o.id)
        );
      }
    });
  });

  describe('toJSON and fromJSON', () => {
    it('should serialize and deserialize correctly', () => {
      const options = [
        createOption('123e4567-e89b-12d3-a456-426614174001', 'Option 1', true),
        createOption('123e4567-e89b-12d3-a456-426614174002', 'Option 2', false),
      ];

      const original = QuestionOptions.create(options);
      expect(original.success).toBe(true);

      if (original.success) {
        const json = original.data.toJSON();
        const restored = QuestionOptions.fromJSON(json);

        expect(restored.success).toBe(true);
        if (restored.success) {
          expect(restored.data.count).toBe(original.data.count);
          expect(restored.data.getAll()).toEqual(original.data.getAll());
        }
      }
    });

    it('should fail to deserialize invalid JSON', () => {
      const invalidJson = [
        { id: 'invalid', text: 'Option 1' }, // missing isCorrect
      ];

      const result = QuestionOptions.fromJSON(invalidJson);
      expect(result.success).toBe(false);
    });
  });
});
