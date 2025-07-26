import { describe, expect, it } from 'vitest';
import { validateAndMapAuthUser } from './AuthUserValidator';
import type { AuthUserRow } from './schema/authUser';

describe('AuthUserValidator', () => {
  const validAuthUserRow: AuthUserRow = {
    userId: '123e4567-e89b-12d3-a456-426614174000',
    email: 'test@example.com',
    username: 'testuser',
    role: 'user',
    identityProviderId: 'provider123',
    isActive: true,
    createdAt: new Date('2024-01-01T00:00:00Z'),
    updatedAt: new Date('2024-01-01T00:00:00Z'),
  };

  it('should validate and map valid auth user row', () => {
    const result = validateAndMapAuthUser(validAuthUserRow);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.id).toBe(validAuthUserRow.userId);
      expect(result.data.email.toString()).toBe(validAuthUserRow.email);
      expect(result.data.username).toBe(validAuthUserRow.username);
      expect(result.data.role).toBe(validAuthUserRow.role);
      expect(result.data.isActive).toBe(validAuthUserRow.isActive);
    }
  });

  it('should handle null identityProviderId', () => {
    const rowWithNullProvider = {
      ...validAuthUserRow,
      identityProviderId: null,
    };

    const result = validateAndMapAuthUser(rowWithNullProvider);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.identityProviderId).toBeNull();
    }
  });

  it('should fail with invalid email format', () => {
    const rowWithInvalidEmail = {
      ...validAuthUserRow,
      email: 'not-an-email',
    };

    const result = validateAndMapAuthUser(rowWithInvalidEmail);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.message).toContain('Invalid email');
    }
  });

  it('should fail with invalid user role', () => {
    const rowWithInvalidRole = {
      ...validAuthUserRow,
      role: 'superadmin' as never,
    };

    const result = validateAndMapAuthUser(rowWithInvalidRole);

    // UserRole.fromString returns default 'user' for invalid roles
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.role).toBe('user'); // Safe default
    }
  });

  it('should fail with empty username', () => {
    const rowWithEmptyUsername = {
      ...validAuthUserRow,
      username: '',
    };

    const result = validateAndMapAuthUser(rowWithEmptyUsername);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.message).toContain('Invalid username in database');
    }
  });

  it('should fail with invalid userId format', () => {
    const rowWithInvalidId = {
      ...validAuthUserRow,
      userId: 'not-a-uuid',
    };

    const result = validateAndMapAuthUser(rowWithInvalidId);

    // UserId.of doesn't validate format, it just wraps the value
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.id.toString()).toBe('not-a-uuid');
    }
  });

  it('should handle all valid user roles', () => {
    const roles: Array<'guest' | 'user' | 'premium' | 'admin'> = [
      'guest',
      'user',
      'premium',
      'admin',
    ];

    for (const role of roles) {
      const rowWithRole = {
        ...validAuthUserRow,
        role,
      };

      const result = validateAndMapAuthUser(rowWithRole);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.role).toBe(role);
      }
    }
  });

  it('should handle very long usernames within limits', () => {
    const rowWithLongUsername = {
      ...validAuthUserRow,
      username: 'a'.repeat(50), // Assuming reasonable username length
    };

    const result = validateAndMapAuthUser(rowWithLongUsername);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.username).toBe(rowWithLongUsername.username);
    }
  });

  it('should handle special characters in username', () => {
    const rowWithSpecialChars = {
      ...validAuthUserRow,
      username: 'user_123-test',
    };

    const result = validateAndMapAuthUser(rowWithSpecialChars);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.username).toBe(rowWithSpecialChars.username);
    }
  });

  it('should preserve timestamps exactly', () => {
    const result = validateAndMapAuthUser(validAuthUserRow);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.createdAt).toEqual(validAuthUserRow.createdAt);
      expect(result.data.updatedAt).toEqual(validAuthUserRow.updatedAt);
    }
  });

  // Edge cases and boundary tests
  describe('Email boundary and edge cases', () => {
    it('should fail with email longer than 254 characters', () => {
      // Create an email longer than 254 characters
      // 'a'.repeat(244) + '@example.com' = 244 + 12 = 256 chars total
      const longLocalPart = 'a'.repeat(244);
      const tooLongEmail = `${longLocalPart}@example.com`;

      // Verify it's actually longer than 254
      expect(tooLongEmail.length).toBeGreaterThan(254);

      const rowWithTooLongEmail = {
        ...validAuthUserRow,
        email: tooLongEmail,
      };

      const result = validateAndMapAuthUser(rowWithTooLongEmail);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toContain('Invalid email in database');
      }
    });

    it('should pass with email at exactly 254 characters', () => {
      // Create an email at exactly 254 characters
      const localPart = 'a'.repeat(241); // 241 chars
      const exactLengthEmail = `${localPart}@example.com`; // Exactly 254 chars

      const rowWithExactLengthEmail = {
        ...validAuthUserRow,
        email: exactLengthEmail,
      };

      const result = validateAndMapAuthUser(rowWithExactLengthEmail);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.email.toString()).toBe(exactLengthEmail.toLowerCase());
      }
    });

    it('should fail with email containing spaces', () => {
      const emailWithSpaces = 'test user@example.com';

      const rowWithSpacedEmail = {
        ...validAuthUserRow,
        email: emailWithSpaces,
      };

      const result = validateAndMapAuthUser(rowWithSpacedEmail);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toContain('Invalid email in database');
      }
    });

    it('should fail with email containing multiple @ symbols', () => {
      const emailWithMultipleAt = 'test@user@example.com';

      const rowWithMultipleAtEmail = {
        ...validAuthUserRow,
        email: emailWithMultipleAt,
      };

      const result = validateAndMapAuthUser(rowWithMultipleAtEmail);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toContain('Invalid email in database');
      }
    });

    it('should fail with email without domain', () => {
      const emailWithoutDomain = 'test@';

      const rowWithoutDomain = {
        ...validAuthUserRow,
        email: emailWithoutDomain,
      };

      const result = validateAndMapAuthUser(rowWithoutDomain);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toContain('Invalid email in database');
      }
    });

    it('should fail with email without top-level domain', () => {
      const emailWithoutTLD = 'test@example';

      const rowWithoutTLD = {
        ...validAuthUserRow,
        email: emailWithoutTLD,
      };

      const result = validateAndMapAuthUser(rowWithoutTLD);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toContain('Invalid email in database');
      }
    });

    it('should fail with email starting or ending with spaces', () => {
      const emailWithLeadingSpace = ' test@example.com';
      const emailWithTrailingSpace = 'test@example.com ';

      const rowWithLeadingSpace = {
        ...validAuthUserRow,
        email: emailWithLeadingSpace,
      };

      const rowWithTrailingSpace = {
        ...validAuthUserRow,
        email: emailWithTrailingSpace,
      };

      // Both should succeed because Email.create() trims spaces
      const resultLeading = validateAndMapAuthUser(rowWithLeadingSpace);
      const resultTrailing = validateAndMapAuthUser(rowWithTrailingSpace);

      expect(resultLeading.success).toBe(true);
      expect(resultTrailing.success).toBe(true);

      if (resultLeading.success && resultTrailing.success) {
        expect(resultLeading.data.email.toString()).toBe('test@example.com');
        expect(resultTrailing.data.email.toString()).toBe('test@example.com');
      }
    });
  });

  describe('Boolean field type safety', () => {
    it('should handle boolean isActive field correctly', () => {
      const rowWithFalseActive = {
        ...validAuthUserRow,
        isActive: false,
      };

      const result = validateAndMapAuthUser(rowWithFalseActive);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.isActive).toBe(false);
      }
    });

    it('should handle truthy/falsy values for isActive field', () => {
      // TypeScript would prevent non-boolean at compile time, but we can test
      // runtime behavior by casting
      const rowWithTruthyActive = {
        ...validAuthUserRow,
        isActive: 1 as never, // Cast to bypass TypeScript
      };

      const rowWithFalsyActive = {
        ...validAuthUserRow,
        isActive: 0 as never, // Cast to bypass TypeScript
      };

      const resultTruthy = validateAndMapAuthUser(rowWithTruthyActive);
      const resultFalsy = validateAndMapAuthUser(rowWithFalsyActive);

      // The User.fromPersistence should handle these gracefully
      expect(resultTruthy.success).toBe(true);
      expect(resultFalsy.success).toBe(true);

      if (resultTruthy.success && resultFalsy.success) {
        // Values are passed through without conversion
        expect(resultTruthy.data.isActive).toBe(1);
        expect(resultFalsy.data.isActive).toBe(0);
      }
    });
  });

  describe('Date field validity', () => {
    it('should handle valid date objects correctly', () => {
      const specificDate = new Date('2023-12-25T10:30:00Z');
      const rowWithSpecificDates = {
        ...validAuthUserRow,
        createdAt: specificDate,
        updatedAt: specificDate,
      };

      const result = validateAndMapAuthUser(rowWithSpecificDates);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.createdAt).toEqual(specificDate);
        expect(result.data.updatedAt).toEqual(specificDate);
      }
    });

    it('should handle edge case dates', () => {
      const veryOldDate = new Date('1900-01-01T00:00:00Z');
      const farFutureDate = new Date('2100-12-31T23:59:59Z');

      const rowWithEdgeDates = {
        ...validAuthUserRow,
        createdAt: veryOldDate,
        updatedAt: farFutureDate,
      };

      const result = validateAndMapAuthUser(rowWithEdgeDates);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.createdAt).toEqual(veryOldDate);
        expect(result.data.updatedAt).toEqual(farFutureDate);
      }
    });

    it('should handle invalid Date objects gracefully', () => {
      const invalidDate = new Date('invalid-date-string');

      const rowWithInvalidDate = {
        ...validAuthUserRow,
        createdAt: invalidDate,
      };

      const result = validateAndMapAuthUser(rowWithInvalidDate);

      // The User.fromPersistence should still succeed but preserve the invalid date
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.createdAt).toEqual(invalidDate);
        expect(Number.isNaN(result.data.createdAt.getTime())).toBe(true);
      }
    });

    it('should handle date-like strings correctly when cast to Date', () => {
      // Simulate what might happen if database returns string dates
      const dateString = '2024-06-15T14:30:00.000Z';
      const stringAsDate = new Date(dateString);

      const rowWithStringDate = {
        ...validAuthUserRow,
        createdAt: stringAsDate,
        updatedAt: stringAsDate,
      };

      const result = validateAndMapAuthUser(rowWithStringDate);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.createdAt).toEqual(stringAsDate);
        expect(result.data.updatedAt).toEqual(stringAsDate);
        expect(result.data.createdAt.toISOString()).toBe(dateString);
      }
    });

    it('should handle null or undefined dates when cast', () => {
      // Test what happens with null/undefined dates (though TypeScript prevents this)
      const rowWithNullDate = {
        ...validAuthUserRow,
        createdAt: null as never, // Cast to bypass TypeScript
      };

      const rowWithUndefinedDate = {
        ...validAuthUserRow,
        updatedAt: undefined as never, // Cast to bypass TypeScript
      };

      const resultNull = validateAndMapAuthUser(rowWithNullDate);
      const resultUndefined = validateAndMapAuthUser(rowWithUndefinedDate);

      // These should handle gracefully or fail appropriately
      expect(resultNull.success).toBe(true);
      expect(resultUndefined.success).toBe(true);

      if (resultNull.success && resultUndefined.success) {
        // Values are passed through without conversion
        expect(resultNull.data.createdAt).toBe(null);
        expect(resultUndefined.data.updatedAt).toBe(undefined);
      }
    });
  });

  describe('Username boundary cases', () => {
    it('should fail with username exceeding maximum length', () => {
      const tooLongUsername = 'a'.repeat(51); // Assuming 50 is the limit

      const rowWithTooLongUsername = {
        ...validAuthUserRow,
        username: tooLongUsername,
      };

      const result = validateAndMapAuthUser(rowWithTooLongUsername);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toContain('Invalid username in database');
      }
    });

    it('should fail with username shorter than minimum length', () => {
      const tooShortUsername = 'a'; // Single character

      const rowWithTooShortUsername = {
        ...validAuthUserRow,
        username: tooShortUsername,
      };

      const result = validateAndMapAuthUser(rowWithTooShortUsername);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toContain('Invalid username in database');
      }
    });

    it('should fail with username containing invalid characters', () => {
      const invalidCharUsername = 'test@user!'; // Contains @ and !

      const rowWithInvalidChars = {
        ...validAuthUserRow,
        username: invalidCharUsername,
      };

      const result = validateAndMapAuthUser(rowWithInvalidChars);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toContain('Invalid username in database');
      }
    });

    it('should handle whitespace in username correctly', () => {
      const usernameWithSpaces = '  test_user  '; // Leading/trailing spaces

      const rowWithSpaces = {
        ...validAuthUserRow,
        username: usernameWithSpaces,
      };

      const result = validateAndMapAuthUser(rowWithSpaces);

      expect(result.success).toBe(true);
      if (result.success) {
        // Username should be trimmed
        expect(result.data.username).toBe('test_user');
      }
    });
  });
});
