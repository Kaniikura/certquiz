/**
 * Email value object unit tests
 * @fileoverview Test email validation and business invariants
 */

import { ValidationError } from '@api/shared/errors';
import { describe, expect, it } from 'vitest';
import { Email } from './Email';

describe('Email', () => {
  describe('create', () => {
    it('should create valid email successfully', () => {
      // Arrange & Act
      const result = Email.create('test@example.com');

      // Assert
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.toString()).toBe('test@example.com');
      }
    });

    it('should normalize email by trimming and lowercasing', () => {
      // Arrange & Act
      const result = Email.create('  TEST@EXAMPLE.COM  ');

      // Assert
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.toString()).toBe('test@example.com');
      }
    });

    it('should fail with empty email', () => {
      // Arrange & Act
      const result = Email.create('');

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(ValidationError);
        expect(result.error.message).toContain('Invalid email format');
      }
    });

    it('should fail with whitespace-only email', () => {
      // Arrange & Act
      const result = Email.create('   ');

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(ValidationError);
        expect(result.error.message).toContain('Invalid email format');
      }
    });

    it('should fail with invalid email format - no @', () => {
      // Arrange & Act
      const result = Email.create('invalid-email');

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(ValidationError);
        expect(result.error.message).toContain('Invalid email format');
      }
    });

    it('should fail with invalid email format - no domain', () => {
      // Arrange & Act
      const result = Email.create('test@');

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(ValidationError);
        expect(result.error.message).toContain('Invalid email format');
      }
    });

    it('should fail with invalid email format - no local part', () => {
      // Arrange & Act
      const result = Email.create('@example.com');

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(ValidationError);
        expect(result.error.message).toContain('Invalid email format');
      }
    });

    it('should fail with invalid email format - multiple @', () => {
      // Arrange & Act
      const result = Email.create('test@@example.com');

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(ValidationError);
        expect(result.error.message).toContain('Invalid email format');
      }
    });

    it('should accept valid email formats', () => {
      const validEmails = [
        'test@example.com',
        'user.name+tag@example.co.uk',
        'admin@sub.domain.org',
        '123@456.com',
        'test-email@test-domain.net',
      ];

      for (const email of validEmails) {
        const result = Email.create(email);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.toString()).toBe(email.toLowerCase());
        }
      }
    });
  });

  describe('toString', () => {
    it('should return email string', () => {
      // Arrange
      const email = Email.create('test@example.com');
      expect(email.success).toBe(true);

      // Act & Assert
      if (email.success) {
        expect(email.data.toString()).toBe('test@example.com');
      }
    });
  });

  describe('equals', () => {
    it('should return true for identical emails', () => {
      // Arrange
      const email1 = Email.create('test@example.com');
      const email2 = Email.create('test@example.com');
      expect(email1.success && email2.success).toBe(true);

      // Act & Assert
      if (email1.success && email2.success) {
        expect(email1.data.equals(email2.data)).toBe(true);
      }
    });

    it('should return true for normalized identical emails', () => {
      // Arrange
      const email1 = Email.create('TEST@EXAMPLE.COM');
      const email2 = Email.create('test@example.com');
      expect(email1.success && email2.success).toBe(true);

      // Act & Assert
      if (email1.success && email2.success) {
        expect(email1.data.equals(email2.data)).toBe(true);
      }
    });

    it('should return false for different emails', () => {
      // Arrange
      const email1 = Email.create('test1@example.com');
      const email2 = Email.create('test2@example.com');
      expect(email1.success && email2.success).toBe(true);

      // Act & Assert
      if (email1.success && email2.success) {
        expect(email1.data.equals(email2.data)).toBe(false);
      }
    });

    it('should return false when comparing with same instance', () => {
      // Arrange
      const email = Email.create('test@example.com');
      expect(email.success).toBe(true);

      // Act & Assert
      if (email.success) {
        expect(email.data.equals(email.data)).toBe(true);
      }
    });
  });
});
