/**
 * QuizConfig value object unit tests
 * @fileoverview Tests for QuizConfig creation, validation, and serialization
 */

import { describe, expect, it } from 'vitest';
import { InvalidQuestionCountError, InvalidTimeLimitError } from '../errors/QuizErrors';
import type { Category, Difficulty, ExamType } from './ExamTypes';
import { QuizConfig, type QuizConfigDTO } from './QuizConfig';

const EXAM_CCNA: ExamType = 'CCNA';
const EXAM_CCNP: ExamType = 'CCNP_ENCOR';
const CAT_OSPF: Category = 'OSPF';
const CAT_BGP: Category = 'BGP';
const CAT_SWITCHING: Category = 'SWITCHING';
const DIFF_ADV: Difficulty = 'ADVANCED';
const DIFF_INT: Difficulty = 'INTERMEDIATE';
const DIFF_BEG: Difficulty = 'BEGINNER';
const DIFF_MIX: Difficulty = 'MIXED';

describe('QuizConfig', () => {
  describe('create', () => {
    it('should create valid config with required properties', () => {
      // Arrange
      const props = {
        examType: EXAM_CCNA,
        questionCount: 10,
      };

      // Act
      const result = QuizConfig.create(props);

      // Assert
      expect(result.success).toBe(true);
      if (!result.success) return;

      const config = result.data;
      expect(config.examType).toBe(EXAM_CCNA);
      expect(config.category).toBe(null);
      expect(config.questionCount).toBe(10);
      expect(config.timeLimit).toBe(null);
      expect(config.difficulty).toBe(DIFF_MIX);
      expect(config.enforceSequentialAnswering).toBe(false);
      expect(config.requireAllAnswers).toBe(false);
      expect(config.autoCompleteWhenAllAnswered).toBe(true);
      expect(config.fallbackLimitSeconds).toBe(QuizConfig.DEFAULT_FALLBACK_LIMIT_SECONDS);
    });

    it('should create config with all properties specified', () => {
      // Arrange
      const props = {
        examType: EXAM_CCNP,
        category: CAT_OSPF,
        questionCount: 20,
        timeLimit: 1800, // 30 minutes
        difficulty: DIFF_ADV,
        enforceSequentialAnswering: true,
        requireAllAnswers: true,
        autoCompleteWhenAllAnswered: false,
        fallbackLimitSeconds: 7200, // 2 hours
      };

      // Act
      const result = QuizConfig.create(props);

      // Assert
      expect(result.success).toBe(true);
      if (!result.success) return;

      const config = result.data;
      expect(config.examType).toBe(EXAM_CCNP);
      expect(config.category).toBe(CAT_OSPF);
      expect(config.questionCount).toBe(20);
      expect(config.timeLimit).toBe(1800);
      expect(config.difficulty).toBe(DIFF_ADV);
      expect(config.enforceSequentialAnswering).toBe(true);
      expect(config.requireAllAnswers).toBe(true);
      expect(config.autoCompleteWhenAllAnswered).toBe(false);
      expect(config.fallbackLimitSeconds).toBe(7200);
    });

    it('should fail when question count is too low', () => {
      // Arrange
      const props = {
        examType: EXAM_CCNA,
        questionCount: 0,
      };

      // Act
      const result = QuizConfig.create(props);

      // Assert
      expect(result.success).toBe(false);
      if (result.success) return;
      expect(result.error).toBeInstanceOf(InvalidQuestionCountError);
    });

    it('should fail when question count is too high', () => {
      // Arrange
      const props = {
        examType: EXAM_CCNA,
        questionCount: QuizConfig.MAX_QUESTION_COUNT + 1,
      };

      // Act
      const result = QuizConfig.create(props);

      // Assert
      expect(result.success).toBe(false);
      if (result.success) return;
      expect(result.error).toBeInstanceOf(InvalidQuestionCountError);
    });

    it('should fail when time limit is too short', () => {
      // Arrange
      const props = {
        examType: EXAM_CCNA,
        questionCount: 10,
        timeLimit: 30, // Less than 60 seconds
      };

      // Act
      const result = QuizConfig.create(props);

      // Assert
      expect(result.success).toBe(false);
      if (result.success) return;
      expect(result.error).toBeInstanceOf(InvalidTimeLimitError);
    });

    it('should accept minimum valid time limit', () => {
      // Arrange
      const props = {
        examType: EXAM_CCNA,
        questionCount: 10,
        timeLimit: 60, // Exactly 60 seconds (minimum)
      };

      // Act
      const result = QuizConfig.create(props);

      // Assert
      expect(result.success).toBe(true);
      if (!result.success) return;
      expect(result.data.timeLimit).toBe(60);
    });
  });

  describe('toDTO', () => {
    it('should serialize config to DTO', () => {
      // Arrange
      const configResult = QuizConfig.create({
        examType: EXAM_CCNP,
        category: CAT_BGP,
        questionCount: 15,
        timeLimit: 2700,
        difficulty: DIFF_INT,
        enforceSequentialAnswering: true,
        requireAllAnswers: false,
        autoCompleteWhenAllAnswered: true,
        fallbackLimitSeconds: 10800,
      });
      expect(configResult.success).toBe(true);
      if (!configResult.success) return;
      const config = configResult.data;

      // Act
      const dto = config.toDTO();

      // Assert
      const expected: QuizConfigDTO = {
        examType: EXAM_CCNP,
        category: CAT_BGP,
        questionCount: 15,
        timeLimit: 2700,
        difficulty: DIFF_INT,
        enforceSequentialAnswering: true,
        requireAllAnswers: false,
        autoCompleteWhenAllAnswered: true,
        fallbackLimitSeconds: 10800,
      };
      expect(dto).toEqual(expected);
    });

    it('should serialize config with null category', () => {
      // Arrange
      const configResult = QuizConfig.create({
        examType: EXAM_CCNA,
        questionCount: 10,
      });
      expect(configResult.success).toBe(true);
      if (!configResult.success) return;
      const config = configResult.data;

      // Act
      const dto = config.toDTO();

      // Assert
      expect(dto.category).toBe(null);
    });
  });

  describe('fromDTO', () => {
    it('should deserialize DTO to config', () => {
      // Arrange
      const dto: QuizConfigDTO = {
        examType: EXAM_CCNP,
        category: CAT_OSPF,
        questionCount: 25,
        timeLimit: 3600,
        difficulty: DIFF_ADV,
        enforceSequentialAnswering: false,
        requireAllAnswers: true,
        autoCompleteWhenAllAnswered: false,
        fallbackLimitSeconds: 14400,
      };

      // Act
      const config = QuizConfig.fromDTO(dto);

      // Assert
      expect(config.examType).toBe(EXAM_CCNP);
      expect(config.category).toBe(CAT_OSPF);
      expect(config.questionCount).toBe(25);
      expect(config.timeLimit).toBe(3600);
      expect(config.difficulty).toBe(DIFF_ADV);
      expect(config.enforceSequentialAnswering).toBe(false);
      expect(config.requireAllAnswers).toBe(true);
      expect(config.autoCompleteWhenAllAnswered).toBe(false);
      expect(config.fallbackLimitSeconds).toBe(14400);
    });

    it('should roundtrip serialize/deserialize correctly', () => {
      // Arrange
      const originalConfigResult = QuizConfig.create({
        examType: EXAM_CCNA,
        category: CAT_SWITCHING,
        questionCount: 12,
        timeLimit: 1200,
        difficulty: DIFF_BEG,
        enforceSequentialAnswering: true,
        requireAllAnswers: false,
        autoCompleteWhenAllAnswered: true,
        fallbackLimitSeconds: 7200,
      });
      expect(originalConfigResult.success).toBe(true);
      if (!originalConfigResult.success) return;
      const originalConfig = originalConfigResult.data;

      // Act
      const dto = originalConfig.toDTO();
      const roundtripConfig = QuizConfig.fromDTO(dto);

      // Assert - All properties should match
      expect(roundtripConfig.examType).toBe(originalConfig.examType);
      expect(roundtripConfig.category).toBe(originalConfig.category);
      expect(roundtripConfig.questionCount).toBe(originalConfig.questionCount);
      expect(roundtripConfig.timeLimit).toBe(originalConfig.timeLimit);
      expect(roundtripConfig.difficulty).toBe(originalConfig.difficulty);
      expect(roundtripConfig.enforceSequentialAnswering).toBe(
        originalConfig.enforceSequentialAnswering
      );
      expect(roundtripConfig.requireAllAnswers).toBe(originalConfig.requireAllAnswers);
      expect(roundtripConfig.autoCompleteWhenAllAnswered).toBe(
        originalConfig.autoCompleteWhenAllAnswered
      );
      expect(roundtripConfig.fallbackLimitSeconds).toBe(originalConfig.fallbackLimitSeconds);
    });
  });

  describe('constants', () => {
    it('should have correct maximum question count', () => {
      expect(QuizConfig.MAX_QUESTION_COUNT).toBe(100);
    });

    it('should have correct default fallback limit', () => {
      expect(QuizConfig.DEFAULT_FALLBACK_LIMIT_SECONDS).toBe(4 * 60 * 60); // 4 hours
    });
  });

  describe('immutability', () => {
    it('should have readonly properties', () => {
      // Arrange
      const configResult = QuizConfig.create({
        examType: EXAM_CCNA,
        questionCount: 10,
      });
      expect(configResult.success).toBe(true);
      if (!configResult.success) return;
      const config = configResult.data;

      // Act & Assert - Properties should be readonly (compile-time check)
      // This test verifies the readonly property declarations work correctly
      expect(config.examType).toBe(EXAM_CCNA);
      expect(config.questionCount).toBe(10);

      // The readonly nature is enforced at compile time by TypeScript
      // Runtime immutability would require Object.freeze() or similar
    });
  });
});
