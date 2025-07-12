/**
 * UserId value object unit tests
 * @fileoverview Test branded ID type and factory functions
 */

import { describe, expect, it } from 'vitest';
import { UserId } from './UserId';

describe('UserId', () => {
  describe('generate', () => {
    it('should generate valid UUID', () => {
      // Act
      const id = UserId.generate();

      // Assert
      expect(typeof id).toBe('string');
      expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    });

    it('should generate unique IDs', () => {
      // Act
      const id1 = UserId.generate();
      const id2 = UserId.generate();

      // Assert
      expect(id1).not.toBe(id2);
    });

    it('should generate multiple unique IDs', () => {
      // Act
      const ids = Array.from({ length: 100 }, () => UserId.generate());

      // Assert
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(100);
    });
  });

  describe('of', () => {
    it('should create UserId from valid string', () => {
      // Arrange
      const validId = '123e4567-e89b-12d3-a456-426614174000';

      // Act
      const id = UserId.of(validId);

      // Assert
      expect(typeof id).toBe('string');
      expect(UserId.toString(id)).toBe(validId);
    });

    it('should preserve original string value', () => {
      // Arrange
      const originalValue = 'custom-user-id';

      // Act
      const id = UserId.of(originalValue);

      // Assert
      expect(UserId.toString(id)).toBe(originalValue);
    });

    it('should handle empty string', () => {
      // Arrange & Act
      const id = UserId.of('');

      // Assert
      expect(UserId.toString(id)).toBe('');
    });
  });

  describe('equals', () => {
    it('should return true for identical IDs', () => {
      // Arrange
      const id1 = UserId.of('user-123');
      const id2 = UserId.of('user-123');

      // Act & Assert
      expect(UserId.equals(id1, id2)).toBe(true);
    });

    it('should return false for different IDs', () => {
      // Arrange
      const id1 = UserId.of('user-123');
      const id2 = UserId.of('user-456');

      // Act & Assert
      expect(UserId.equals(id1, id2)).toBe(false);
    });

    it('should return true for same instance', () => {
      // Arrange
      const id = UserId.generate();

      // Act & Assert
      expect(UserId.equals(id, id)).toBe(true);
    });

    it('should work with generated IDs', () => {
      // Arrange
      const id1 = UserId.generate();
      const id2 = UserId.of(UserId.toString(id1));

      // Act & Assert
      expect(UserId.equals(id1, id2)).toBe(true);
    });
  });

  describe('toString', () => {
    it('should return string representation', () => {
      // Arrange
      const originalValue = 'user-test-123';
      const id = UserId.of(originalValue);

      // Act & Assert
      expect(UserId.toString(id)).toBe(originalValue);
    });

    it('should work with generated IDs', () => {
      // Arrange
      const id = UserId.generate();

      // Act
      const stringValue = UserId.toString(id);

      // Assert
      expect(typeof stringValue).toBe('string');
      expect(stringValue.length).toBeGreaterThan(0);
    });

    it('should be idempotent', () => {
      // Arrange
      const id = UserId.generate();

      // Act
      const str1 = UserId.toString(id);
      const str2 = UserId.toString(id);

      // Assert
      expect(str1).toBe(str2);
    });
  });

  describe('branded type safety', () => {
    it('should maintain type safety at compile time', () => {
      // Arrange
      const id = UserId.generate();
      const plainString = 'not-a-userid';

      // Act & Assert - These assertions verify the branded type works
      expect(typeof id).toBe('string');
      expect(typeof plainString).toBe('string');

      // Type system should prevent: UserId.equals(id, plainString)
      // But at runtime, they're both strings
      expect(id).not.toBe(plainString);
    });

    it('should allow round-trip conversion', () => {
      // Arrange
      const originalId = UserId.generate();

      // Act
      const stringValue = UserId.toString(originalId);
      const reconstructedId = UserId.of(stringValue);

      // Assert
      expect(UserId.equals(originalId, reconstructedId)).toBe(true);
    });
  });

  describe('factory function consistency', () => {
    it('should follow same pattern as other ID types', () => {
      // Assert factory methods exist
      expect(typeof UserId.of).toBe('function');
      expect(typeof UserId.generate).toBe('function');
      expect(typeof UserId.equals).toBe('function');
      expect(typeof UserId.toString).toBe('function');
    });

    it('should have consistent behavior across multiple calls', () => {
      // Arrange
      const testValue = 'consistent-test-id';

      // Act
      const id1 = UserId.of(testValue);
      const id2 = UserId.of(testValue);

      // Assert
      expect(UserId.equals(id1, id2)).toBe(true);
      expect(UserId.toString(id1)).toBe(testValue);
      expect(UserId.toString(id2)).toBe(testValue);
    });
  });
});
