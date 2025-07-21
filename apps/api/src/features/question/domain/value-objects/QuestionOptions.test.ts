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

    it('should shuffle options', () => {
      const result = QuestionOptions.create(validOptions);
      expect(result.success).toBe(true);
      if (result.success) {
        const shuffled = result.data.shuffle();
        expect(shuffled).toHaveLength(3);
        // Should contain all the same options
        expect(shuffled.map((o) => o.id).sort()).toEqual(validOptions.map((o) => o.id).sort());
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
