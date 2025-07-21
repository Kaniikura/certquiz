import type { Clock } from '@api/shared/clock';
import { Accuracy } from '../value-objects/Accuracy';
import { CategoryStats } from '../value-objects/CategoryStats';
import { Experience } from '../value-objects/Experience';
import { Level } from '../value-objects/Level';
import { Streak } from '../value-objects/Streak';
import { StudyTime } from '../value-objects/StudyTime';

interface QuizResult {
  correctAnswers: number;
  totalQuestions: number;
  category: string;
  studyTimeMinutes: number;
  clock: Clock;
}

interface UserProgressPersistence {
  level: number;
  experience: number;
  totalQuestions: number;
  correctAnswers: number;
  accuracy: string; // Decimal stored as string
  studyTimeMinutes: number;
  currentStreak: number;
  lastStudyDate: Date | null;
  categoryStats: object; // JSONB
  updatedAt: Date;
}

/**
 * UserProgress entity representing user's learning progress and statistics
 */
export class UserProgress {
  constructor(
    public readonly level: Level,
    public readonly experience: Experience,
    public readonly totalQuestions: number,
    public readonly correctAnswers: number,
    public readonly accuracy: Accuracy,
    public readonly studyTime: StudyTime,
    public readonly currentStreak: Streak,
    public readonly lastStudyDate: Date | null,
    public readonly categoryStats: CategoryStats,
    public readonly updatedAt: Date
  ) {}

  /**
   * Create new UserProgress with default values
   */
  static create(clock: Clock): UserProgress {
    const level = Level.create(1);
    const experience = Experience.create(0);
    const accuracy = Accuracy.create(0);
    const studyTime = StudyTime.create(0);
    const streak = Streak.create(0);
    const categoryStats = CategoryStats.createEmpty();

    if (
      !level.success ||
      !experience.success ||
      !accuracy.success ||
      !studyTime.success ||
      !streak.success ||
      !categoryStats.success
    ) {
      throw new Error('Failed to create default UserProgress value objects');
    }

    return new UserProgress(
      level.data, // Start at level 1
      experience.data, // No experience
      0, // No questions answered
      0, // No correct answers
      accuracy.data, // 0% accuracy
      studyTime.data, // No study time
      streak.data, // No streak
      null, // Never studied
      categoryStats.data, // No category stats
      clock.now() // Current time
    );
  }

  /**
   * Restore UserProgress from database row
   */
  static fromPersistence(row: UserProgressPersistence): UserProgress {
    const level = Level.create(row.level);
    const experience = Experience.create(row.experience);

    // Validate parseFloat result before passing to Accuracy
    const parsedAccuracy = parseFloat(row.accuracy);
    if (Number.isNaN(parsedAccuracy)) {
      throw new Error(`Invalid accuracy value in database: ${row.accuracy}`);
    }
    const accuracy = Accuracy.create(parsedAccuracy);

    const studyTime = StudyTime.create(row.studyTimeMinutes);
    const streak = Streak.create(row.currentStreak);
    const categoryStats = CategoryStats.create(row.categoryStats);

    if (
      !level.success ||
      !experience.success ||
      !accuracy.success ||
      !studyTime.success ||
      !streak.success ||
      !categoryStats.success
    ) {
      throw new Error('Failed to restore UserProgress from persistence - invalid data');
    }

    return new UserProgress(
      level.data,
      experience.data,
      row.totalQuestions,
      row.correctAnswers,
      accuracy.data,
      studyTime.data,
      streak.data,
      row.lastStudyDate,
      categoryStats.data,
      row.updatedAt
    );
  }

  /**
   * Add quiz result and update all related statistics
   */
  addQuizResult(result: QuizResult): UserProgress {
    // Calculate experience gained from this quiz
    const experienceGained = this.calculateExperienceGain(result);
    const newExperienceResult = this.experience.add(experienceGained);
    if (!newExperienceResult.success) {
      throw new Error('Failed to add experience points');
    }
    const newExperience = newExperienceResult.data;

    // Update totals
    const newTotalQuestions = this.totalQuestions + result.totalQuestions;
    const newCorrectAnswers = this.correctAnswers + result.correctAnswers;

    // Recalculate accuracy
    const newAccuracy = Accuracy.fromQuizResults(newCorrectAnswers, newTotalQuestions);

    // Add study time
    const newStudyTimeResult = this.studyTime.addMinutes(result.studyTimeMinutes);
    if (!newStudyTimeResult.success) {
      throw new Error('Failed to add study time minutes');
    }
    const newStudyTime = newStudyTimeResult.data;

    // Update category statistics
    const newCategoryStats = this.categoryStats.updateCategory(
      result.category,
      (this.categoryStats.getCategoryStats(result.category)?.correct || 0) + result.correctAnswers,
      (this.categoryStats.getCategoryStats(result.category)?.total || 0) + result.totalQuestions
    );

    // Create updated progress but keep original lastStudyDate for streak calculation
    const beforeStreakUpdate = new UserProgress(
      this.level,
      newExperience,
      newTotalQuestions,
      newCorrectAnswers,
      newAccuracy,
      newStudyTime,
      this.currentStreak,
      this.lastStudyDate, // Keep original for streak calculation
      newCategoryStats,
      result.clock.now()
    );

    // Calculate new level and then update streak (which will update lastStudyDate)
    return beforeStreakUpdate.calculateLevel().updateStreak(result.clock);
  }

  /**
   * Update streak based on study pattern
   */
  updateStreak(clock: Clock): UserProgress {
    const now = clock.now();

    if (!this.lastStudyDate) {
      // First time studying
      const newStreak = Streak.create(1);
      if (!newStreak.success) {
        throw new Error('Failed to create initial streak');
      }
      return new UserProgress(
        this.level,
        this.experience,
        this.totalQuestions,
        this.correctAnswers,
        this.accuracy,
        this.studyTime,
        newStreak.data,
        now,
        this.categoryStats,
        now
      );
    }

    const daysDiff = this.getDaysDifference(this.lastStudyDate, now);

    let newStreak: Streak;
    if (daysDiff === 0) {
      // Same day, maintain current streak (but ensure it's at least 1)
      if (this.currentStreak.isActive()) {
        newStreak = this.currentStreak;
      } else {
        const streakResult = Streak.create(1);
        if (!streakResult.success) {
          throw new Error('Failed to create streak');
        }
        newStreak = streakResult.data;
      }
    } else if (daysDiff === 1) {
      // Next day, increment streak (or start at 2 if current is 1)
      newStreak = this.currentStreak.increment();
    } else {
      // Gap > 1 day, reset streak to 1
      const streakResult = Streak.create(1);
      if (!streakResult.success) {
        throw new Error('Failed to reset streak');
      }
      newStreak = streakResult.data;
    }

    return new UserProgress(
      this.level,
      this.experience,
      this.totalQuestions,
      this.correctAnswers,
      this.accuracy,
      this.studyTime,
      newStreak,
      now,
      this.categoryStats,
      now
    );
  }

  /**
   * Calculate level based on current experience
   */
  calculateLevel(): UserProgress {
    const newLevel = Level.fromExperience(this.experience.value);

    return new UserProgress(
      newLevel,
      this.experience,
      this.totalQuestions,
      this.correctAnswers,
      this.accuracy,
      this.studyTime,
      this.currentStreak,
      this.lastStudyDate,
      this.categoryStats,
      this.updatedAt
    );
  }

  /**
   * Convert to database persistence format
   */
  toPersistence(): UserProgressPersistence {
    return {
      level: this.level.value,
      experience: this.experience.value,
      totalQuestions: this.totalQuestions,
      correctAnswers: this.correctAnswers,
      accuracy: this.accuracy.value.toString(),
      studyTimeMinutes: this.studyTime.minutes,
      currentStreak: this.currentStreak.days,
      lastStudyDate: this.lastStudyDate,
      categoryStats: this.categoryStats.stats,
      updatedAt: this.updatedAt,
    };
  }

  /**
   * Calculate experience gain from quiz result
   */
  private calculateExperienceGain(result: QuizResult): number {
    let totalXP = 0;

    // Award XP for each correct answer (10 XP base)
    totalXP += result.correctAnswers * 10;

    // Award consolation XP for incorrect answers (2 XP each)
    const incorrectAnswers = result.totalQuestions - result.correctAnswers;
    totalXP += incorrectAnswers * 2;

    // Bonus XP for perfect scores
    if (result.correctAnswers === result.totalQuestions && result.totalQuestions > 0) {
      totalXP += Math.floor(result.totalQuestions * 0.5); // 50% bonus
    }

    return totalXP;
  }

  /**
   * Calculate days difference between two dates
   */
  private getDaysDifference(date1: Date, date2: Date): number {
    // Reset time to midnight for accurate day calculation
    const d1 = new Date(date1);
    d1.setHours(0, 0, 0, 0);
    const d2 = new Date(date2);
    d2.setHours(0, 0, 0, 0);

    const oneDay = 24 * 60 * 60 * 1000;
    const diffDays = Math.floor((d2.getTime() - d1.getTime()) / oneDay);
    return Math.abs(diffDays);
  }
}
