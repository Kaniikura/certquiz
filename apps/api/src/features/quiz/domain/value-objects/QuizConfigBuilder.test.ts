import { unwrapOrFail } from '@api/test-support/helpers';
import { describe, expect, it } from 'vitest';
import { aQuizConfig, QuizConfigBuilder } from './QuizConfigBuilder';

describe('QuizConfigBuilder', () => {
  describe('build()', () => {
    it('should return success when all required fields are set', () => {
      const result = aQuizConfig().withExamType('CCNA').withQuestionCount(5).build();

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.examType).toBe('CCNA');
        expect(result.data.questionCount).toBe(5);
      }
    });

    it('should fail when examType is missing', () => {
      const builder = new QuizConfigBuilder(false); // No defaults
      // Don't set examType, only set questionCount
      const result = builder.withQuestionCount(5).build();

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toContain('missing required fields');
      }
    });

    it('should fail when questionCount is missing', () => {
      const builder = new QuizConfigBuilder(false); // No defaults
      // Don't set questionCount, only set examType
      const result = builder.withExamType('CCNA').build();

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toContain('missing required fields');
      }
    });

    it('should work with default values from constructor', () => {
      // Default constructor sets examType: 'CCNA' and questionCount: 5
      const result = aQuizConfig().build();

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.examType).toBe('CCNA');
        expect(result.data.questionCount).toBe(5);
      }
    });
  });

  describe('unwrapOrFail() helper', () => {
    it('should return QuizConfig when result is successful', () => {
      const config = unwrapOrFail(
        aQuizConfig().withExamType('CCNP_ENCOR').withQuestionCount(10).build()
      );

      expect(config.examType).toBe('CCNP_ENCOR');
      expect(config.questionCount).toBe(10);
    });

    it('should throw when result failed', () => {
      const builder = new QuizConfigBuilder(false); // No defaults

      expect(() => {
        unwrapOrFail(builder.withExamType('CCNA').build()); // Missing questionCount
      }).toThrow('missing required fields');
    });
  });

  describe('fluent interface', () => {
    it('should allow method chaining', () => {
      const config = unwrapOrFail(
        aQuizConfig()
          .withExamType('CCNP_ENCOR')
          .withCategory('OSPF')
          .withQuestionCount(20)
          .withTimeLimit(7200)
          .withDifficulty('ADVANCED')
          .withSequentialAnswering(true)
          .withRequireAllAnswers(true)
          .withAutoComplete(false)
          .build()
      );

      expect(config.examType).toBe('CCNP_ENCOR');
      expect(config.category).toBe('OSPF');
      expect(config.questionCount).toBe(20);
      expect(config.timeLimit).toBe(7200);
      expect(config.difficulty).toBe('ADVANCED');
      expect(config.enforceSequentialAnswering).toBe(true);
      expect(config.requireAllAnswers).toBe(true);
      expect(config.autoCompleteWhenAllAnswered).toBe(false);
    });
  });

  describe('type safety', () => {
    it('should prevent unsafe type assertions', () => {
      // This test ensures our type guard approach works correctly
      const builder = new QuizConfigBuilder(false); // No defaults
      const _partialProps = { examType: 'CCNA' as const }; // Missing questionCount

      // The old approach would have used: props as QuizConfigProps
      // The new approach uses type guard to validate at runtime
      const result = builder.withExamType('CCNA').build();

      expect(result.success).toBe(false);
      // This proves the type guard correctly identified missing properties
    });
  });
});
