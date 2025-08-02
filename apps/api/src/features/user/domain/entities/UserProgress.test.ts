import { describe, expect, it } from 'vitest';
import { TestClock } from '@/test-support';
import { Accuracy } from '../value-objects/Accuracy';
import { CategoryStats } from '../value-objects/CategoryStats';
import { Experience } from '../value-objects/Experience';
import { Level } from '../value-objects/Level';
import { Streak } from '../value-objects/Streak';
import { StudyTime } from '../value-objects/StudyTime';
import { UserProgress } from './UserProgress';

describe('UserProgress', () => {
  describe('create', () => {
    it('should create new user progress with default values', () => {
      const clock = new TestClock(new Date('2025-01-01T12:00:00Z'));
      const progress = UserProgress.create(clock);

      expect(progress.level.value).toBe(1);
      expect(progress.experience.value).toBe(0);
      expect(progress.totalQuestions).toBe(0);
      expect(progress.correctAnswers).toBe(0);
      expect(progress.accuracy.value).toBe(0);
      expect(progress.studyTime.minutes).toBe(0);
      expect(progress.currentStreak.days).toBe(0);
      expect(progress.lastStudyDate).toBeNull();
      expect(progress.categoryStats.getAllCategories()).toEqual([]);
    });
  });

  describe('constructor', () => {
    it('should create valid UserProgress instance', () => {
      const clock = new TestClock(new Date('2025-01-01T12:00:00Z'));
      const level = Level.create(1);
      const experience = Experience.create(0);
      const accuracy = Accuracy.create(80);
      const studyTime = StudyTime.create(120);
      const streak = Streak.create(7);
      const categoryStats = CategoryStats.createEmpty();

      if (
        !level.success ||
        !experience.success ||
        !accuracy.success ||
        !studyTime.success ||
        !streak.success ||
        !categoryStats.success
      ) {
        throw new Error('Failed to create value objects');
      }

      const progress = new UserProgress(
        level.data,
        experience.data,
        100, // totalQuestions
        80, // correctAnswers
        accuracy.data,
        studyTime.data,
        streak.data,
        null,
        categoryStats.data,
        clock.now()
      );

      expect(progress.totalQuestions).toBe(100);
      expect(progress.correctAnswers).toBe(80);
    });

    it('should throw error when correctAnswers exceed totalQuestions', () => {
      const clock = new TestClock(new Date('2025-01-01T12:00:00Z'));
      const level = Level.create(1);
      const experience = Experience.create(0);
      const accuracy = Accuracy.create(80);
      const studyTime = StudyTime.create(120);
      const streak = Streak.create(7);
      const categoryStats = CategoryStats.createEmpty();

      if (
        !level.success ||
        !experience.success ||
        !accuracy.success ||
        !studyTime.success ||
        !streak.success ||
        !categoryStats.success
      ) {
        throw new Error('Failed to create value objects');
      }

      expect(() => {
        new UserProgress(
          level.data,
          experience.data,
          50, // totalQuestions
          100, // correctAnswers - invalid: more than total
          accuracy.data,
          studyTime.data,
          streak.data,
          null,
          categoryStats.data,
          clock.now()
        );
      }).toThrow('Invalid progress data: correctAnswers (100) cannot exceed totalQuestions (50)');
    });
  });

  describe('fromPersistence', () => {
    it('should restore from database row', () => {
      const dbRow = {
        level: 5,
        experience: 400,
        totalQuestions: 100,
        correctAnswers: 80,
        accuracy: '80.00',
        studyTimeMinutes: 120,
        currentStreak: 7,
        lastStudyDate: new Date('2025-01-01T12:00:00Z'),
        categoryStats: {
          version: 1,
          categories: {
            CCNA: { correct: 8, total: 10, accuracy: 80 },
          },
        },
        updatedAt: new Date('2025-01-01T12:00:00Z'),
      };

      const progress = UserProgress.fromPersistence(dbRow);

      expect(progress.level.value).toBe(5);
      expect(progress.experience.value).toBe(400);
      expect(progress.totalQuestions).toBe(100);
      expect(progress.correctAnswers).toBe(80);
      expect(progress.accuracy.value).toBe(80);
      expect(progress.studyTime.minutes).toBe(120);
      expect(progress.currentStreak.days).toBe(7);
      expect(progress.lastStudyDate).toEqual(new Date('2025-01-01T12:00:00Z'));
      expect(progress.categoryStats.getCategoryStats('CCNA')).toEqual({
        correct: 8,
        total: 10,
        accuracy: 80,
      });
    });

    it('should throw error for invalid accuracy value', () => {
      const dbRow = {
        level: 5,
        experience: 400,
        totalQuestions: 100,
        correctAnswers: 80,
        accuracy: 'invalid-number', // This will cause parseFloat to return NaN
        studyTimeMinutes: 120,
        currentStreak: 7,
        lastStudyDate: new Date('2025-01-01T12:00:00Z'),
        categoryStats: {
          version: 1,
          categories: {},
        },
        updatedAt: new Date('2025-01-01T12:00:00Z'),
      };

      expect(() => UserProgress.fromPersistence(dbRow)).toThrow(
        'Invalid accuracy value in database: invalid-number'
      );
    });

    it('should throw error when correctAnswers exceed totalQuestions', () => {
      const dbRow = {
        level: 5,
        experience: 400,
        totalQuestions: 50,
        correctAnswers: 100, // Invalid: more correct answers than total questions
        accuracy: '80.00',
        studyTimeMinutes: 120,
        currentStreak: 7,
        lastStudyDate: new Date('2025-01-01T12:00:00Z'),
        categoryStats: {
          version: 1,
          categories: {},
        },
        updatedAt: new Date('2025-01-01T12:00:00Z'),
      };

      expect(() => UserProgress.fromPersistence(dbRow)).toThrow(
        'Invalid progress data: correctAnswers (100) cannot exceed totalQuestions (50)'
      );
    });
  });

  describe('addQuizResult', () => {
    it('should update progress with quiz results', () => {
      const clock = new TestClock(new Date('2025-01-01T12:00:00Z'));
      const progress = UserProgress.create(clock);

      const updated = progress.addQuizResult({
        correctAnswers: 8,
        totalQuestions: 10,
        category: 'CCNA',
        studyTimeMinutes: 30,
        clock,
      });

      expect(updated.totalQuestions).toBe(10);
      expect(updated.correctAnswers).toBe(8);
      expect(updated.accuracy.value).toBe(80);
      expect(updated.studyTime.minutes).toBe(30);
      expect(updated.lastStudyDate).toEqual(clock.now());

      const ccnaStats = updated.categoryStats.getCategoryStats('CCNA');
      expect(ccnaStats).toEqual({
        correct: 8,
        total: 10,
        accuracy: 80,
      });

      // Experience should be calculated based on correct answers and difficulty
      expect(updated.experience.value).toBeGreaterThan(0);
    });

    it('should calculate experience based on results', () => {
      const clock = new TestClock(new Date('2025-01-01T12:00:00Z'));
      const progress = UserProgress.create(clock);

      // Perfect score should give more XP
      const perfectResult = progress.addQuizResult({
        correctAnswers: 10,
        totalQuestions: 10,
        category: 'CCNA',
        studyTimeMinutes: 30,
        clock,
      });

      // Imperfect score should give less XP
      const imperfectResult = progress.addQuizResult({
        correctAnswers: 5,
        totalQuestions: 10,
        category: 'CCNA',
        studyTimeMinutes: 30,
        clock,
      });

      expect(perfectResult.experience.value).toBeGreaterThan(imperfectResult.experience.value);
    });

    it('should automatically calculate level from experience', () => {
      const clock = new TestClock(new Date('2025-01-01T12:00:00Z'));
      const progress = UserProgress.create(clock);

      // Add enough XP to reach level 2 (100+ XP)
      const updated = progress.addQuizResult({
        correctAnswers: 10,
        totalQuestions: 10,
        category: 'CCNA',
        studyTimeMinutes: 30,
        clock,
      });

      // Should calculate level from experience
      const expectedLevel = Level.fromExperience(updated.experience.value);
      expect(updated.level.value).toBe(expectedLevel.value);
    });
  });

  describe('updateStreak', () => {
    it('should increment streak for consecutive study days', () => {
      const clock = new TestClock(new Date('2025-01-01T12:00:00Z'));
      const progress = UserProgress.create(clock).addQuizResult({
        correctAnswers: 8,
        totalQuestions: 10,
        category: 'CCNA',
        studyTimeMinutes: 30,
        clock,
      });

      // Study the next day
      clock.advanceByDays(1);
      const updated = progress.updateStreak(clock);

      expect(updated.currentStreak.days).toBe(2);
      expect(updated.lastStudyDate).toEqual(clock.now());
    });

    it('should reset streak if gap is more than 1 day', () => {
      const clock = new TestClock(new Date('2025-01-01T12:00:00Z'));
      const progress = UserProgress.create(clock).addQuizResult({
        correctAnswers: 8,
        totalQuestions: 10,
        category: 'CCNA',
        studyTimeMinutes: 30,
        clock,
      });

      // Skip 2 days
      clock.advanceByDays(3);
      const updated = progress.updateStreak(clock);

      expect(updated.currentStreak.days).toBe(1);
      expect(updated.lastStudyDate).toEqual(clock.now());
    });

    it('should maintain streak for same day study', () => {
      const clock = new TestClock(new Date('2025-01-01T12:00:00Z'));
      const progress = UserProgress.create(clock).addQuizResult({
        correctAnswers: 8,
        totalQuestions: 10,
        category: 'CCNA',
        studyTimeMinutes: 30,
        clock,
      });

      // Study again same day
      const updated = progress.updateStreak(clock);

      expect(updated.currentStreak.days).toBe(1);
      expect(updated.lastStudyDate).toEqual(clock.now());
    });
  });

  describe('calculateLevel', () => {
    it('should calculate level from current experience', () => {
      const clock = new TestClock(new Date('2025-01-01T12:00:00Z'));
      const _progress = UserProgress.create(clock);

      // Manually set experience to test level calculation
      const level = Level.create(1);
      const experience = Experience.create(250); // Should be level 3
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
        throw new Error('Failed to create value objects');
      }

      const progressWithXP = new UserProgress(
        level.data,
        experience.data,
        0,
        0,
        accuracy.data,
        studyTime.data,
        streak.data,
        null,
        categoryStats.data,
        clock.now()
      );

      const updated = progressWithXP.calculateLevel();
      expect(updated.level.value).toBe(3); // 250 XP = level 3
    });
  });

  describe('toPersistence', () => {
    it('should convert to database row format', () => {
      const clock = new TestClock(new Date('2025-01-01T12:00:00Z'));
      const progress = UserProgress.create(clock).addQuizResult({
        correctAnswers: 8,
        totalQuestions: 10,
        category: 'CCNA',
        studyTimeMinutes: 30,
        clock,
      });

      const row = progress.toPersistence();

      expect(row.level).toBe(progress.level.value);
      expect(row.experience).toBe(progress.experience.value);
      expect(row.totalQuestions).toBe(progress.totalQuestions);
      expect(row.correctAnswers).toBe(progress.correctAnswers);
      expect(row.accuracy).toBe(progress.accuracy.value.toString());
      expect(row.studyTimeMinutes).toBe(progress.studyTime.minutes);
      expect(row.currentStreak).toBe(progress.currentStreak.days);
      expect(row.lastStudyDate).toBe(progress.lastStudyDate);
      expect(row.categoryStats).toEqual(progress.categoryStats.stats);
      expect(row.updatedAt).toEqual(progress.updatedAt);
    });
  });
});
