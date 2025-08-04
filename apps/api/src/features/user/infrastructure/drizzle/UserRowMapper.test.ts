import type { AuthUserRow } from '@api/features/auth/infrastructure/drizzle/schema/authUser';
import { describe, expect, it } from 'vitest';
import { mapAuthUserRowToUser, mapJoinedRowToUser } from './UserRowMapper';

describe('UserRowMapper', () => {
  describe('mapAuthUserRowToUser', () => {
    const validAuthUserRow: AuthUserRow = {
      userId: '123e4567-e89b-12d3-a456-426614174000',
      email: 'test@example.com',
      username: 'testuser',
      role: 'user',
      identityProviderId: 'provider123',
      isActive: true,
      createdAt: new Date('2024-01-01T00:00:00Z'),
      updatedAt: new Date('2024-01-01T00:00:00Z'),
      lastLoginAt: null,
    };

    it('should map valid auth user row to User entity', () => {
      const result = mapAuthUserRowToUser(validAuthUserRow);

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

      const result = mapAuthUserRowToUser(rowWithNullProvider);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.identityProviderId).toBeNull();
      }
    });

    it('should fail with invalid email format', () => {
      const rowWithInvalidEmail = {
        ...validAuthUserRow,
        email: 'invalid-email',
      };

      const result = mapAuthUserRowToUser(rowWithInvalidEmail);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toContain('Invalid email');
      }
    });

    it("should handle invalid role by defaulting to 'user'", () => {
      const rowWithInvalidRole = {
        ...validAuthUserRow,
        role: 'invalid' as never,
      };

      const result = mapAuthUserRowToUser(rowWithInvalidRole);

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

      const result = mapAuthUserRowToUser(rowWithEmptyUsername);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toContain('Invalid username in database');
      }
    });
  });

  describe('mapJoinedRowToUser', () => {
    const validJoinedRow = {
      // Auth user fields
      userId: '123e4567-e89b-12d3-a456-426614174000',
      email: 'test@example.com',
      username: 'testuser',
      role: 'user' as const,
      identityProviderId: 'provider123',
      isActive: true,
      createdAt: new Date('2024-01-01T00:00:00Z'),
      updatedAt: new Date('2024-01-01T00:00:00Z'),
      lastLoginAt: null,
      // User progress fields
      level: 5,
      experience: 2500,
      totalQuestions: 100,
      correctAnswers: 75,
      accuracy: '75.00',
      studyTimeMinutes: 300,
      currentStreak: 7,
      lastStudyDate: new Date('2024-01-15T00:00:00Z'),
      categoryStats: {
        version: 1,
        categories: {
          'network-fundamentals': { correct: 40, total: 50, accuracy: 80 },
          routing: { correct: 35, total: 50, accuracy: 70 },
        },
      },
      progressUpdatedAt: new Date('2024-01-15T00:00:00Z'),
    };

    it('should map valid joined row to User entity with progress', () => {
      const result = mapJoinedRowToUser(validJoinedRow);

      expect(result.success).toBe(true);
      if (result.success) {
        const user = result.data;
        // Auth fields
        expect(user.id.toString()).toBe(validJoinedRow.userId);
        expect(user.email.toString()).toBe(validJoinedRow.email);
        expect(user.username).toBe(validJoinedRow.username);

        // Progress fields
        expect(user.progress.level.value).toBe(validJoinedRow.level);
        expect(user.progress.experience.value).toBe(validJoinedRow.experience);
        expect(user.progress.accuracy.value).toBe(75);
        expect(user.progress.currentStreak.days).toBe(validJoinedRow.currentStreak);
        expect(user.progress.categoryStats.stats).toEqual(validJoinedRow.categoryStats);
      }
    });

    it('should handle null lastStudyDate', () => {
      const rowWithNullDate = {
        ...validJoinedRow,
        lastStudyDate: null,
      };

      const result = mapJoinedRowToUser(rowWithNullDate);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.progress.lastStudyDate).toBeNull();
      }
    });

    it('should calculate accuracy correctly', () => {
      const rowWithDifferentAccuracy = {
        ...validJoinedRow,
        totalQuestions: 200,
        correctAnswers: 150,
        accuracy: '75.00',
      };

      const result = mapJoinedRowToUser(rowWithDifferentAccuracy);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.progress.accuracy.value).toBe(75);
      }
    });

    it('should fail with invalid categoryStats structure', () => {
      const rowWithInvalidStats = {
        ...validJoinedRow,
        categoryStats: 'invalid' as never,
      };

      const result = mapJoinedRowToUser(rowWithInvalidStats);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toContain('categoryStats');
      }
    });

    it('should fail with negative progress values', () => {
      const rowWithNegativeValues = {
        ...validJoinedRow,
        level: -1,
      };

      const result = mapJoinedRowToUser(rowWithNegativeValues);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toContain('Failed to restore UserProgress');
      }
    });

    it('should handle when correctAnswers exceed totalQuestions', () => {
      const rowWithInvalidCounts = {
        ...validJoinedRow,
        totalQuestions: 50,
        correctAnswers: 100,
      };

      const result = mapJoinedRowToUser(rowWithInvalidCounts);

      // UserProgress should now validate this constraint and fail
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toContain(
          'correctAnswers (100) cannot exceed totalQuestions (50)'
        );
      }
    });

    it('should handle empty categoryStats', () => {
      const rowWithEmptyStats = {
        ...validJoinedRow,
        categoryStats: { version: 1, categories: {} },
      };

      const result = mapJoinedRowToUser(rowWithEmptyStats);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.progress.categoryStats.stats.categories).toEqual({});
      }
    });

    it('should handle missing categoryStats version', () => {
      const rowWithNoVersion = {
        ...validJoinedRow,
        categoryStats: { categories: {} } as never,
      };

      const result = mapJoinedRowToUser(rowWithNoVersion);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toContain(
          'Failed to restore UserProgress from persistence - invalid data'
        );
      }
    });
  });
});
