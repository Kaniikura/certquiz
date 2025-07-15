/**
 * Logger middleware tests
 * @fileoverview Tests for the HTTP logger middleware with AsyncLocalStorage
 */

import { getRootLogger, type Logger } from '@api/infra/logger';
import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createLoggerMiddleware, type LoggerVariables } from './logger';
import { type RequestIdVariables, requestIdMiddleware } from './request-id';

describe('Logger Middleware', () => {
  let app: Hono<{ Variables: LoggerVariables & RequestIdVariables }>;

  beforeEach(() => {
    // Reset for each test
    process.env.NODE_ENV = 'test';
    process.env.LOG_LEVEL = 'silent';

    // Create fresh app instance with proper typing
    app = new Hono<{ Variables: LoggerVariables & RequestIdVariables }>();

    // Add request ID middleware first (required)
    app.use('*', requestIdMiddleware());

    // Add logger middleware
    app.use('*', createLoggerMiddleware());
  });

  describe('Basic functionality', () => {
    it('should add logger to context', async () => {
      let capturedLogger: Logger | undefined;

      app.get('/test', (c) => {
        capturedLogger = c.get('logger');
        return c.text('OK');
      });

      const res = await app.request('/test');

      expect(res.status).toBe(200);
      expect(capturedLogger).toBeDefined();
      if (capturedLogger) {
        expect(capturedLogger.info).toBeInstanceOf(Function);
        expect(capturedLogger.warn).toBeInstanceOf(Function);
        expect(capturedLogger.error).toBeInstanceOf(Function);
        expect(capturedLogger.debug).toBeInstanceOf(Function);
      }
    });

    it('should add correlationId to context', async () => {
      let capturedCorrelationId: string | undefined;

      app.get('/test', (c) => {
        capturedCorrelationId = c.get('correlationId') as string;
        return c.text('OK');
      });

      const res = await app.request('/test');

      expect(res.status).toBe(200);
      expect(capturedCorrelationId).toBeDefined();
      expect(typeof capturedCorrelationId).toBe('string');
    });

    it('should use requestId as correlationId for backward compatibility', async () => {
      let capturedRequestId: string | undefined;
      let capturedCorrelationId: string | undefined;

      app.get('/test', (c) => {
        capturedRequestId = c.get('requestId');
        capturedCorrelationId = c.get('correlationId') as string;
        return c.text('OK');
      });

      const res = await app.request('/test');

      expect(res.status).toBe(200);
      expect(capturedRequestId).toBeDefined();
      expect(capturedCorrelationId).toBeDefined();
      expect(capturedCorrelationId).toBe(capturedRequestId);
    });
  });

  describe('Request logging', () => {
    it('should log request start and completion', async () => {
      const logSpy = vi.fn();
      const logger = getRootLogger();

      // Spy on logger methods
      vi.spyOn(logger, 'child').mockReturnValue({
        info: logSpy,
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
        fatal: vi.fn(),
        trace: vi.fn(),
        child: vi.fn(),
        level: 'info',
        bindings: vi.fn(),
        flush: vi.fn(),
      } as unknown as ReturnType<typeof logger.child>);

      app.get('/test', (c) => c.text('OK'));

      const res = await app.request('/test');

      expect(res.status).toBe(200);

      // Should log start and completion
      expect(logSpy).toHaveBeenCalledWith('request.start');
      expect(logSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 200,
          duration: expect.any(Number),
          durationMs: expect.stringMatching(/^\d+ms$/),
        }),
        'request.completed'
      );
    });

    it('should include request metadata in child logger', async () => {
      const childSpy = vi.fn().mockImplementation(() => getRootLogger());
      const logger = getRootLogger();
      vi.spyOn(logger, 'child').mockImplementation(childSpy);

      await app.request('/test/path', {
        method: 'POST',
        headers: {
          'user-agent': 'Test Agent',
        },
      });

      expect(childSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'POST',
          path: '/test/path',
          userAgent: 'Test Agent',
        })
      );
    });

    it('should log errors when route throws', async () => {
      const errorLogSpy = vi.fn();
      const infoSpy = vi.fn();
      const logger = getRootLogger();

      vi.spyOn(logger, 'child').mockReturnValue({
        info: infoSpy,
        error: errorLogSpy,
        warn: vi.fn(),
        debug: vi.fn(),
        fatal: vi.fn(),
        trace: vi.fn(),
        child: vi.fn(),
        level: 'info',
        bindings: vi.fn(),
        flush: vi.fn(),
      } as unknown as ReturnType<typeof logger.child>);

      const testError = new Error('Test error');
      app.get('/error', () => {
        throw testError;
      });

      // Add error handler to prevent Hono from swallowing the error
      app.onError((_err, c) => {
        return c.text('Error handled', 500);
      });

      const res = await app.request('/error');

      // Should return 500 status
      expect(res.status).toBe(500);

      // Should have logged the failed request (without error details since Hono doesn't expose them)
      expect(errorLogSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 500,
          duration: expect.any(Number),
          durationMs: expect.stringMatching(/^\d+ms$/),
        }),
        'request.failed'
      );
    });

    it('should log 4xx errors as failed requests', async () => {
      const errorLogSpy = vi.fn();
      const infoSpy = vi.fn();
      const logger = getRootLogger();

      vi.spyOn(logger, 'child').mockReturnValue({
        info: infoSpy,
        error: errorLogSpy,
        warn: vi.fn(),
        debug: vi.fn(),
        fatal: vi.fn(),
        trace: vi.fn(),
        child: vi.fn(),
        level: 'info',
        bindings: vi.fn(),
        flush: vi.fn(),
      } as unknown as ReturnType<typeof logger.child>);

      app.get('/not-found', (c) => {
        return c.text('Not Found', 404);
      });

      const res = await app.request('/not-found');

      expect(res.status).toBe(404);

      // Should have logged as failed request
      expect(errorLogSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 404,
          duration: expect.any(Number),
          durationMs: expect.stringMatching(/^\d+ms$/),
        }),
        'request.failed'
      );
    });
  });

  describe('AsyncLocalStorage integration', () => {
    it('should maintain correlation context throughout request', async () => {
      const correlationIds: (string | undefined)[] = [];

      app.get('/test', async (c) => {
        const { getCorrelationId } = await import('@api/infra/logger');

        // Capture at different points
        correlationIds.push(getCorrelationId());

        await new Promise((resolve) => setTimeout(resolve, 10));
        correlationIds.push(getCorrelationId());

        await Promise.resolve().then(() => {
          correlationIds.push(getCorrelationId());
        });

        return c.text('OK');
      });

      const res = await app.request('/test');

      expect(res.status).toBe(200);
      expect(correlationIds).toHaveLength(3);
      expect(correlationIds[0]).toBeDefined();
      expect(correlationIds[1]).toBe(correlationIds[0]);
      expect(correlationIds[2]).toBe(correlationIds[0]);
    });

    it('should isolate correlation context between requests', async () => {
      const correlationIds: string[] = [];

      app.get('/capture', (c) => {
        const id = c.get('correlationId') as string;
        correlationIds.push(id);
        return c.text(id);
      });

      // Make multiple concurrent requests
      const requests = Array(5)
        .fill(null)
        .map(() => app.request('/capture'));
      const responses = await Promise.all(requests);

      // All should succeed
      responses.forEach((res) => expect(res.status).toBe(200));

      // Should have 5 different correlation IDs
      expect(correlationIds).toHaveLength(5);
      expect(new Set(correlationIds).size).toBe(5);
    });
  });

  describe('Custom logger instance', () => {
    it('should accept custom root logger', async () => {
      const customLogger = getRootLogger();
      const customApp = new Hono<{ Variables: LoggerVariables & RequestIdVariables }>();

      customApp.use('*', requestIdMiddleware());
      customApp.use('*', createLoggerMiddleware(customLogger));

      let capturedLogger: Logger | undefined;
      customApp.get('/test', (c) => {
        capturedLogger = c.get('logger');
        return c.text('OK');
      });

      const res = await customApp.request('/test');

      expect(res.status).toBe(200);
      expect(capturedLogger).toBeDefined();
    });
  });

  describe('Performance tracking', () => {
    it('should measure request duration accurately', async () => {
      const logSpy = vi.fn();
      const logger = getRootLogger();

      vi.spyOn(logger, 'child').mockReturnValue({
        info: logSpy,
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
        fatal: vi.fn(),
        trace: vi.fn(),
        child: vi.fn(),
        level: 'info',
        bindings: vi.fn(),
        flush: vi.fn(),
      } as unknown as ReturnType<typeof logger.child>);

      app.get('/slow', async (c) => {
        await new Promise((resolve) => setTimeout(resolve, 50));
        return c.text('OK');
      });

      const res = await app.request('/slow');

      expect(res.status).toBe(200);

      // Check that duration was logged and is reasonable
      const completedCall = logSpy.mock.calls.find((call) => call[1] === 'request.completed');

      expect(completedCall).toBeDefined();
      if (completedCall) {
        expect(completedCall[0].duration).toBeGreaterThanOrEqual(45); // Allow some variance
        expect(completedCall[0].duration).toBeLessThan(100);
        expect(completedCall[0].durationMs).toMatch(/^\d+ms$/);
      }
    });
  });
});
