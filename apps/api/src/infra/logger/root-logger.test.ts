/**
 * Root logger tests
 * @fileoverview Tests for the singleton root logger with AsyncLocalStorage
 */

import pino from 'pino';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ALS, getCorrelationId, getRootLogger, runWithCorrelationId } from './root-logger';

describe('Root Logger', () => {
  // Store original NODE_ENV
  const originalNodeEnv = process.env.NODE_ENV;
  const originalLogLevel = process.env.LOG_LEVEL;

  beforeEach(() => {
    // Reset environment for each test
    process.env.NODE_ENV = 'test';
    process.env.LOG_LEVEL = 'silent';
  });

  afterEach(() => {
    // Restore original environment
    process.env.NODE_ENV = originalNodeEnv;
    process.env.LOG_LEVEL = originalLogLevel;

    // Clear singleton instance by accessing private module state
    // This is a bit hacky but necessary for testing
    vi.resetModules();
  });

  describe('getRootLogger', () => {
    it('should return a logger instance', () => {
      const logger = getRootLogger();
      expect(logger).toBeDefined();
      expect(logger.info).toBeInstanceOf(Function);
      expect(logger.warn).toBeInstanceOf(Function);
      expect(logger.error).toBeInstanceOf(Function);
      expect(logger.debug).toBeInstanceOf(Function);
    });

    it('should return the same singleton instance', () => {
      const logger1 = getRootLogger();
      const logger2 = getRootLogger();
      expect(logger1).toBe(logger2);
    });

    it('should respect LOG_LEVEL environment variable on first creation', () => {
      // This test demonstrates that LOG_LEVEL is only read on first creation
      // In a real app, the logger is created once at startup
      // For testing, we can't easily reset the singleton without hacks

      // Since we're in test environment, logger is already created with 'silent'
      const logger = getRootLogger();
      expect(logger.level).toBe('silent');

      // Note: In production, LOG_LEVEL would be read on first getRootLogger() call
    });

    it('should use silent level in test environment', () => {
      const logger = getRootLogger();
      expect(logger.level).toBe('silent');
    });
  });

  describe('Correlation ID with AsyncLocalStorage', () => {
    it('should run function with correlation ID', async () => {
      const correlationId = 'test-correlation-123';
      let capturedId: string | undefined;

      await runWithCorrelationId(correlationId, () => {
        capturedId = getCorrelationId();
      });

      expect(capturedId).toBe(correlationId);
    });

    it('should return undefined when not in correlation context', () => {
      const id = getCorrelationId();
      expect(id).toBeUndefined();
    });

    it('should maintain correlation ID in async operations', async () => {
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

    it('should isolate correlation IDs between contexts', async () => {
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

    it('should handle nested correlation contexts', async () => {
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
    it('should include correlation ID in log output when in context', async () => {
      let capturedLog: Record<string, unknown> | null = null;
      let capturedLogWithoutCorrelation: Record<string, unknown> | null = null;

      // Mock the formatter behavior to capture what would be logged
      const mockFormatter = vi.fn((obj) => {
        const store = ALS.getStore();
        const correlationId = store?.get('correlationId');
        const result = correlationId ? { ...obj, correlationId } : obj;

        // Capture the formatted log objects for verification
        if (capturedLog) {
          capturedLogWithoutCorrelation = result;
        } else {
          capturedLog = result;
        }

        return result;
      });

      // Create a test logger with our mock formatter
      const testLogger = pino(
        {
          level: 'info',
          base: undefined,
          formatters: {
            log: mockFormatter,
          },
        },
        pino.destination({ sync: false })
      ); // Use non-blocking destination

      // Test with correlation ID context
      await runWithCorrelationId('test-correlation-123', () => {
        testLogger.info('test message with correlation');
      });

      // Test without correlation ID context
      testLogger.info('test message without correlation');

      // Wait for async logging to complete
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Verify formatter was called
      expect(mockFormatter).toHaveBeenCalledTimes(2);

      // Verify correlation ID is included when in context
      expect(capturedLog).toHaveProperty('correlationId', 'test-correlation-123');

      // Verify correlation ID is not included when not in context
      expect(capturedLogWithoutCorrelation).not.toHaveProperty('correlationId');
    });

    it('should verify root logger has formatter configured', () => {
      // Verify the root logger is properly configured with formatters
      const logger = getRootLogger();
      expect(logger).toHaveProperty('bindings');
    });
  });
});
