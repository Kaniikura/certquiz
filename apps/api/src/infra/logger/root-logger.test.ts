/**
 * Root logger tests
 * @fileoverview Tests for the singleton root logger with AsyncLocalStorage
 */

import { PassThrough } from 'node:stream';
import pino from 'pino';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ALS, getCorrelationId, getRootLogger, runWithCorrelationId } from './root-logger';

describe('Root Logger', () => {
  // Store original NODE_ENV
  const originalNodeEnv = process.env.NODE_ENV;
  const originalLogLevel = process.env.LOG_LEVEL;

  beforeEach((): void => {
    // Reset environment for each test
    process.env.NODE_ENV = 'test';
    process.env.LOG_LEVEL = 'silent';
  });

  afterEach((): void => {
    // Restore original environment
    process.env.NODE_ENV = originalNodeEnv;
    process.env.LOG_LEVEL = originalLogLevel;

    // Clear singleton instance by accessing private module state
    // This is a bit hacky but necessary for testing
    vi.resetModules();
  });

  describe('getRootLogger', () => {
    it('should return a logger instance', (): void => {
      const logger = getRootLogger();
      expect(logger).toBeDefined();
      expect(logger.info).toBeInstanceOf(Function);
      expect(logger.warn).toBeInstanceOf(Function);
      expect(logger.error).toBeInstanceOf(Function);
      expect(logger.debug).toBeInstanceOf(Function);
    });

    it('should return the same singleton instance', (): void => {
      const logger1 = getRootLogger();
      const logger2 = getRootLogger();
      expect(logger1).toBe(logger2);
    });

    it('should use LOG_LEVEL from environment on first creation', (): void => {
      // Since we reset modules in afterEach and set LOG_LEVEL in beforeEach,
      // this verifies the logger respects the LOG_LEVEL environment variable
      const logger = getRootLogger();

      // In test environment, LOG_LEVEL is set to 'silent' and respected
      expect(logger.level).toBe('silent');
    });

    it('should use silent level in test environment', (): void => {
      const logger = getRootLogger();
      expect(logger.level).toBe('silent');
    });
  });

  describe('Correlation ID with AsyncLocalStorage', () => {
    it('should run function with correlation ID', async (): Promise<void> => {
      const correlationId = 'test-correlation-123';
      let capturedId: string | undefined;

      await runWithCorrelationId(correlationId, () => {
        capturedId = getCorrelationId();
      });

      expect(capturedId).toBe(correlationId);
    });

    it('should return undefined when not in correlation context', (): void => {
      const id = getCorrelationId();
      expect(id).toBeUndefined();
    });

    it('should maintain correlation ID in async operations', async (): Promise<void> => {
      const correlationId = 'async-test-456';
      const capturedIds: (string | undefined)[] = [];

      await runWithCorrelationId(correlationId, async () => {
        capturedIds.push(getCorrelationId());

        await new Promise((resolve) => setTimeout(resolve, 10));
        capturedIds.push(getCorrelationId());

        await Promise.resolve().then(() => {
          capturedIds.push(getCorrelationId());
        });
      });

      expect(capturedIds).toEqual([correlationId, correlationId, correlationId]);
    });

    it('should isolate correlation IDs between contexts', async (): Promise<void> => {
      const id1 = 'context-1';
      const id2 = 'context-2';
      const capturedIds: string[] = [];

      await Promise.all([
        runWithCorrelationId(id1, async () => {
          await new Promise((resolve) => setTimeout(resolve, 10));
          const id = getCorrelationId();
          if (id) capturedIds.push(id);
        }),
        runWithCorrelationId(id2, async () => {
          await new Promise((resolve) => setTimeout(resolve, 5));
          const id = getCorrelationId();
          if (id) capturedIds.push(id);
        }),
      ]);

      expect(capturedIds).toContain(id1);
      expect(capturedIds).toContain(id2);
      expect(capturedIds).toHaveLength(2);
    });

    it('should handle nested correlation contexts', async (): Promise<void> => {
      const outerCorrelationId = 'outer-123';
      const innerCorrelationId = 'inner-456';
      let outerCaptured: string | undefined;
      let innerCaptured: string | undefined;
      let afterInnerCaptured: string | undefined;

      await runWithCorrelationId(outerCorrelationId, async () => {
        outerCaptured = getCorrelationId();

        await runWithCorrelationId(innerCorrelationId, async () => {
          innerCaptured = getCorrelationId();
        });

        afterInnerCaptured = getCorrelationId();
      });

      expect(outerCaptured).toBe(outerCorrelationId);
      expect(innerCaptured).toBe(innerCorrelationId);
      expect(afterInnerCaptured).toBe(outerCorrelationId);
    });
  });

  describe('Logger formatters', () => {
    it('should include correlation ID in log output when in context', async (): Promise<void> => {
      const lines: unknown[] = [];

      // Create a stream that captures log output
      const capture = new PassThrough();
      capture.setEncoding('utf8');
      capture.on('data', (chunk: string) => {
        for (const line of chunk.split('\n').filter(Boolean)) {
          lines.push(JSON.parse(line));
        }
      });

      // Create a test logger with the same configuration as the root logger
      const testLogger = pino(
        {
          level: 'info',
          base: undefined, // Don't add pid/hostname; we set our own context
          formatters: {
            log: (obj) => {
              const store = ALS.getStore();
              const correlationId = store?.get('correlationId');
              return correlationId ? { ...obj, correlationId } : obj;
            },
          },
        },
        capture // Use our custom stream
      );

      // Test with correlation ID context
      await runWithCorrelationId('test-correlation-123', () => {
        testLogger.info('test message with correlation');
      });

      // Test without correlation ID context
      testLogger.info('test message without correlation');

      // Give the stream a moment to process
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Verify we captured the logs
      expect(lines.length).toBe(2);

      const log1 = lines[0] as Record<string, unknown>;
      const log2 = lines[1] as Record<string, unknown>;

      // Verify correlation ID is included when in context
      expect(log1).toHaveProperty('correlationId', 'test-correlation-123');
      expect(log1).toHaveProperty('msg', 'test message with correlation');

      // Verify correlation ID is not included when not in context
      expect(log2).toHaveProperty('msg', 'test message without correlation');
      expect(log2).not.toHaveProperty('correlationId');
    });

    it('should have proper logger configuration', (): void => {
      const logger = getRootLogger();

      // Verify the root logger is properly configured and functional
      expect(logger).toBeDefined();
      expect(logger).toHaveProperty('level');
      expect(logger.level).toBe('silent'); // In test environment

      // Verify logger has all expected methods
      expect(logger.info).toBeInstanceOf(Function);
      expect(logger.warn).toBeInstanceOf(Function);
      expect(logger.error).toBeInstanceOf(Function);
      expect(logger.debug).toBeInstanceOf(Function);
    });
  });
});
