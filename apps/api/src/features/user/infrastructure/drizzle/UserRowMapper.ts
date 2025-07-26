import { Result } from '@api/shared/result';
import { User } from '../../domain/entities/User';

/**
 * Interface representing a joined row from authUser and userProgress tables
 */
export interface JoinedUserRow {
  // Auth user fields
  userId: string;
  email: string;
  username: string;
  role: string;
  identityProviderId: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  // Progress fields
  level: number;
  experience: number;
  totalQuestions: number;
  correctAnswers: number;
  accuracy: string;
  studyTimeMinutes: number;
  currentStreak: number;
  lastStudyDate: Date | null;
  categoryStats: unknown;
  progressUpdatedAt: Date;
}

/**
 * Pure function to map database rows to domain entities
 * Testable without database dependencies
 */
export function mapJoinedRowToUser(row: JoinedUserRow): Result<User, Error> {
  try {
    // Validate categoryStats
    if (typeof row.categoryStats !== 'object' || row.categoryStats === null) {
      return Result.fail(
        new Error(`Invalid categoryStats for user ${row.userId}: must be an object`)
      );
    }

    // Create objects that match the domain entity's expected interfaces
    const authRow = {
      userId: row.userId,
      email: row.email,
      username: row.username,
      role: row.role,
      identityProviderId: row.identityProviderId,
      isActive: row.isActive,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };

    const progressRow = {
      level: row.level,
      experience: row.experience,
      totalQuestions: row.totalQuestions,
      correctAnswers: row.correctAnswers,
      accuracy: row.accuracy,
      studyTimeMinutes: row.studyTimeMinutes,
      currentStreak: row.currentStreak,
      lastStudyDate: row.lastStudyDate,
      categoryStats: row.categoryStats as object,
      updatedAt: row.progressUpdatedAt,
    };

    return User.fromPersistence(authRow, progressRow);
  } catch (error) {
    return Result.fail(error instanceof Error ? error : new Error('Unknown mapping error'));
  }
}
