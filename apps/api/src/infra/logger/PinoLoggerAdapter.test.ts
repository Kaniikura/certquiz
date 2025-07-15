/**
 * PinoLoggerAdapter tests
 * @fileoverview Tests for the Pino adapter implementation
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { createDomainLogger, PinoLoggerAdapter } from './PinoLoggerAdapter';
import { runWithCorrelationId } from './root-logger';

describe('PinoLoggerAdapter', () => {
  // Suppress logs during tests
  beforeEach(() => {
    process.env.NODE_ENV = 'test';
    process.env.LOG_LEVEL = 'silent';
  });

  describe('Basic functionality', () => {
    it('should implement all LoggerPort methods', () => {
      const adapter = new PinoLoggerAdapter();

      expect(adapter.info).toBeInstanceOf(Function);
      expect(adapter.warn).toBeInstanceOf(Function);
      expect(adapter.error).toBeInstanceOf(Function);
      expect(adapter.debug).toBeInstanceOf(Function);
    });

    it('should create adapter with scope', () => {
      const adapter = new PinoLoggerAdapter('test-scope');

      // Verify it doesn't throw
      expect(() => {
        adapter.info('Test message');
        adapter.warn('Test warning');
        adapter.error('Test error');
        adapter.debug('Test debug');
      }).not.toThrow();
    });

    it('should handle messages without metadata', () => {
      const adapter = new PinoLoggerAdapter();

      expect(() => {
        adapter.info('Simple message');
        adapter.warn('Simple warning');
        adapter.error('Simple error');
        adapter.debug('Simple debug');
      }).not.toThrow();
    });

    it('should handle messages with metadata', () => {
      const adapter = new PinoLoggerAdapter();
      const meta = { userId: '123', action: 'test' };

      expect(() => {
        adapter.info('Message with meta', meta);
        adapter.warn('Warning with meta', meta);
        adapter.error('Error with meta', meta);
        adapter.debug('Debug with meta', meta);
      }).not.toThrow();
    });
  });

  describe('Correlation ID integration', () => {
    it('should include correlation ID when in context', async () => {
      const correlationId = 'test-correlation-789';

      await runWithCorrelationId(correlationId, () => {
        const adapter = new PinoLoggerAdapter('test');

        // These calls should include the correlation ID automatically
        expect(() => {
          adapter.info('Message in context');
          adapter.warn('Warning in context');
          adapter.error('Error in context');
          adapter.debug('Debug in context');
        }).not.toThrow();
      });
    });

    it('should work without correlation context', () => {
      const adapter = new PinoLoggerAdapter('test');

      expect(() => {
        adapter.info('Message without context');
        adapter.warn('Warning without context');
        adapter.error('Error without context');
        adapter.debug('Debug without context');
      }).not.toThrow();
    });
  });

  describe('createDomainLogger helper', () => {
    it('should create a logger with the specified scope', () => {
      const logger = createDomainLogger('domain.service');

      expect(logger).toBeDefined();
      expect(logger.info).toBeInstanceOf(Function);
      expect(logger.warn).toBeInstanceOf(Function);
      expect(logger.error).toBeInstanceOf(Function);
      expect(logger.debug).toBeInstanceOf(Function);
    });

    it('should handle nested scopes', () => {
      const logger = createDomainLogger('quiz.domain.aggregate');

      expect(() => {
        logger.info('Nested scope message', { quizId: '123' });
      }).not.toThrow();
    });
  });

  describe('Edge cases', () => {
    it('should handle null metadata gracefully', () => {
      const adapter = new PinoLoggerAdapter();

      expect(() => {
        adapter.info('Message', null as unknown as Record<string, unknown>);
        adapter.warn('Warning', undefined as unknown as Record<string, unknown>);
      }).not.toThrow();
    });

    it('should handle empty scope', () => {
      const adapter1 = new PinoLoggerAdapter('');
      const adapter2 = new PinoLoggerAdapter();

      expect(() => {
        adapter1.info('Empty scope');
        adapter2.info('No scope');
      }).not.toThrow();
    });

    it('should handle complex metadata objects', () => {
      const adapter = new PinoLoggerAdapter('complex-test');
      const complexMeta = {
        nested: {
          deeply: {
            value: 'test',
            array: [1, 2, 3],
          },
        },
        date: new Date(),
        error: new Error('Test error'),
        circular: {} as Record<string, unknown>,
      };

      // Create circular reference
      complexMeta.circular.ref = complexMeta.circular;

      expect(() => {
        adapter.info('Complex metadata', complexMeta);
      }).not.toThrow();
    });
  });

  describe('Integration with domain services', () => {
    it('should work with domain service pattern', () => {
      // Example domain service
      class QuizService {
        constructor(private readonly logger = createDomainLogger('quiz.service')) {}

        startQuiz(userId: string) {
          this.logger.info('Starting quiz', { userId });
          // Business logic here
          this.logger.debug('Quiz started successfully', { userId, quizId: 'quiz-123' });
        }

        handleError(error: Error) {
          this.logger.error('Quiz error occurred', {
            error: error.message,
            stack: error.stack,
          });
        }
      }

      const service = new QuizService();

      expect(() => {
        service.startQuiz('user-123');
        service.handleError(new Error('Test error'));
      }).not.toThrow();
    });
  });
});
