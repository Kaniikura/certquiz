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
  // Experience calculation constants
  private static readonly XP_PER_CORRECT_ANSWER = 10;
  private static readonly XP_PER_INCORRECT_ANSWER = 2;
  private static readonly PERFECT_SCORE_BONUS_MULTIPLIER = 0.5; // 50% bonus

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
    const newExperience = this.updateExperience(result);
    const { newTotalQuestions, newCorrectAnswers } = this.updateTotals(result);
    const newAccuracy = this.recalculateAccuracy(newCorrectAnswers, newTotalQuestions);
    const newStudyTime = this.addStudyTime(result);
    const newCategoryStats = this.updateCategoryStats(result);

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

    return beforeStreakUpdate.calculateLevel().updateStreak(result.clock);
  }

  /**
   * Update experience points based on quiz result
   */
  private updateExperience(result: QuizResult): Experience {
    const experienceGained = this.calculateExperienceGain(result);
    const newExperienceResult = this.experience.add(experienceGained);
    if (!newExperienceResult.success) {
      throw new Error('Failed to add experience points');
    }
    return newExperienceResult.data;
  }

  /**
   * Update question totals based on quiz result
   */
  private updateTotals(result: QuizResult): {
    newTotalQuestions: number;
    newCorrectAnswers: number;
  } {
    return {
      newTotalQuestions: this.totalQuestions + result.totalQuestions,
      newCorrectAnswers: this.correctAnswers + result.correctAnswers,
    };
  }

  /**
   * Recalculate accuracy based on updated totals
   */
  private recalculateAccuracy(correctAnswers: number, totalQuestions: number): Accuracy {
    return Accuracy.fromQuizResults(correctAnswers, totalQuestions);
  }

  /**
   * Add study time from quiz result
   */
  private addStudyTime(result: QuizResult): StudyTime {
    const newStudyTimeResult = this.studyTime.addMinutes(result.studyTimeMinutes);
    if (!newStudyTimeResult.success) {
      throw new Error('Failed to add study time minutes');
    }
    return newStudyTimeResult.data;
  }

  /**
   * Update category statistics based on quiz result
   */
  private updateCategoryStats(result: QuizResult): CategoryStats {
    return this.categoryStats.updateCategory(
      result.category,
      (this.categoryStats.getCategoryStats(result.category)?.correct || 0) + result.correctAnswers,
      (this.categoryStats.getCategoryStats(result.category)?.total || 0) + result.totalQuestions
    );
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

    // Award XP for each correct answer
    totalXP += result.correctAnswers * UserProgress.XP_PER_CORRECT_ANSWER;

    // Award consolation XP for incorrect answers
    const incorrectAnswers = result.totalQuestions - result.correctAnswers;
    totalXP += incorrectAnswers * UserProgress.XP_PER_INCORRECT_ANSWER;

    // Bonus XP for perfect scores
    if (result.correctAnswers === result.totalQuestions && result.totalQuestions > 0) {
      totalXP += Math.floor(result.totalQuestions * UserProgress.PERFECT_SCORE_BONUS_MULTIPLIER);
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
