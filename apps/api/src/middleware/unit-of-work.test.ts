/**
 * Unit of Work Middleware Tests
 * @fileoverview Tests for UnitOfWork middleware with both real and fake implementations
 */

import type { IUnitOfWork } from '@api/infra/db/IUnitOfWork';
import { createTestLogger } from '@api/test-support/test-logger';
import { FakeUnitOfWork } from '@api/testing/domain/fakes';
import { Hono } from 'hono';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createLoggerMiddleware, type LoggerVariables } from './logger';
import type { UnitOfWorkFactory } from './unit-of-work';
import {
  createSelectiveUnitOfWorkMiddleware,
  createUnitOfWorkMiddleware,
  type UnitOfWorkVariables,
} from './unit-of-work';

describe('Unit of Work Middleware', () => {
  let app: Hono<{ Variables: LoggerVariables & UnitOfWorkVariables }>;
  let mockUnitOfWork: IUnitOfWork;
  let factory: UnitOfWorkFactory;

  beforeEach(() => {
    app = new Hono<{ Variables: LoggerVariables & UnitOfWorkVariables }>();

    // Add logger middleware first
    app.use('*', createLoggerMiddleware(createTestLogger()));

    // Create mock UoW
    mockUnitOfWork = {
      begin: vi.fn().mockResolvedValue(undefined),
      commit: vi.fn().mockResolvedValue(undefined),
      rollback: vi.fn().mockResolvedValue(undefined),
      getUserRepository: vi.fn(),
      getQuizRepository: vi.fn(),
    };

    // Create factory that returns mock
    factory = vi.fn().mockResolvedValue(mockUnitOfWork);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('createUnitOfWorkMiddleware', () => {
    beforeEach(() => {
      // Add error handler to prevent unhandled errors
      app.onError((err, c) => {
        return c.json({ error: err.message }, 500);
      });
    });

    it('should create UoW and set it in context', async () => {
      let capturedUow: IUnitOfWork | null = null;

      app.use('*', createUnitOfWorkMiddleware(factory));
      app.get('/test', (c) => {
        capturedUow = c.get('unitOfWork');
        return c.json({ success: true });
      });

      const response = await app.request('/test');

      expect(response.status).toBe(200);
      expect(factory).toHaveBeenCalledWith(expect.any(Object)); // logger
      expect(mockUnitOfWork.begin).toHaveBeenCalled();
      expect(mockUnitOfWork.commit).toHaveBeenCalled();
      expect(mockUnitOfWork.rollback).not.toHaveBeenCalled();
      expect(capturedUow).toBe(mockUnitOfWork);
    });

    it('should rollback on error', async () => {
      app.use('*', createUnitOfWorkMiddleware(factory));
      app.get('/test', () => {
        throw new Error('Test error');
      });

      const response = await app.request('/test');

      expect(response.status).toBe(500); // Default error response
      expect(mockUnitOfWork.begin).toHaveBeenCalled();
      expect(mockUnitOfWork.commit).not.toHaveBeenCalled();
      expect(mockUnitOfWork.rollback).toHaveBeenCalled();
    });

    it('should handle async errors', async () => {
      app.use('*', createUnitOfWorkMiddleware(factory));
      app.get('/test', async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        throw new Error('Async error');
      });

      const response = await app.request('/test');

      expect(response.status).toBe(500);
      expect(mockUnitOfWork.rollback).toHaveBeenCalled();
    });

    it('should pass through successful responses', async () => {
      app.use('*', createUnitOfWorkMiddleware(factory));
      app.get('/test', (c) => {
        return c.json({ data: 'test' });
      });

      const response = await app.request('/test');
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body).toEqual({ data: 'test' });
      expect(mockUnitOfWork.commit).toHaveBeenCalled();
    });
  });

  describe('createSelectiveUnitOfWorkMiddleware', () => {
    const excludedPaths = new Set(['/health', '/metrics']);

    it('should skip UoW for excluded paths', async () => {
      app.use('*', createSelectiveUnitOfWorkMiddleware(factory, excludedPaths));
      app.get('/health', (c) => {
        // Should not have unitOfWork
        const uow = c.var.unitOfWork; // This will be undefined
        return c.json({ healthy: true, hasUow: !!uow });
      });

      const response = await app.request('/health');
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.hasUow).toBe(false);
      expect(factory).not.toHaveBeenCalled();
    });

    it('should apply UoW for non-excluded paths', async () => {
      let capturedUow: IUnitOfWork | null = null;

      app.use('*', createSelectiveUnitOfWorkMiddleware(factory, excludedPaths));
      app.get('/api/users', (c) => {
        capturedUow = c.get('unitOfWork');
        return c.json({ success: true });
      });

      const response = await app.request('/api/users');

      expect(response.status).toBe(200);
      expect(factory).toHaveBeenCalled();
      expect(mockUnitOfWork.begin).toHaveBeenCalled();
      expect(mockUnitOfWork.commit).toHaveBeenCalled();
      expect(capturedUow).toBe(mockUnitOfWork);
    });

    it('should handle multiple requests correctly', async () => {
      app.use('*', createSelectiveUnitOfWorkMiddleware(factory, excludedPaths));
      app.get('/health', (c) => c.json({ healthy: true }));
      app.get('/api/data', (c) => c.json({ data: 'test' }));

      // Request to excluded path
      const healthResponse = await app.request('/health');
      expect(healthResponse.status).toBe(200);
      expect(factory).not.toHaveBeenCalled();

      // Request to included path
      const dataResponse = await app.request('/api/data');
      expect(dataResponse.status).toBe(200);
      expect(factory).toHaveBeenCalledTimes(1);
    });
  });

  describe('Integration with FakeUnitOfWork', () => {
    it('should work with FakeUnitOfWork implementation', async () => {
      const fakeUow = new FakeUnitOfWork();
      const fakeFactory: UnitOfWorkFactory = async () => fakeUow;

      app.use('*', createUnitOfWorkMiddleware(fakeFactory));
      app.get('/test', (c) => {
        const uow = c.get('unitOfWork');
        expect(uow).toBeInstanceOf(FakeUnitOfWork);
        return c.json({ success: true });
      });

      const response = await app.request('/test');

      expect(response.status).toBe(200);
      expect(fakeUow.hasCommitted()).toBe(true);
      expect(fakeUow.hasRolledBack()).toBe(false);
    });

    it('should handle rollback with FakeUnitOfWork', async () => {
      const fakeUow = new FakeUnitOfWork();
      const fakeFactory: UnitOfWorkFactory = async () => fakeUow;

      app.use('*', createUnitOfWorkMiddleware(fakeFactory));
      app.get('/test', () => {
        throw new Error('Test error');
      });

      const response = await app.request('/test');

      expect(response.status).toBe(500);
      expect(fakeUow.hasCommitted()).toBe(false);
      expect(fakeUow.hasRolledBack()).toBe(true);
    });
  });

  describe('Transaction lifecycle', () => {
    it('should follow correct transaction order: begin -> handler -> commit', async () => {
      const callOrder: string[] = [];

      mockUnitOfWork.begin = vi.fn().mockImplementation(async () => {
        callOrder.push('begin');
      });
      mockUnitOfWork.commit = vi.fn().mockImplementation(async () => {
        callOrder.push('commit');
      });

      app.use('*', createUnitOfWorkMiddleware(factory));
      app.get('/test', () => {
        callOrder.push('handler');
        return new Response('OK');
      });

      await app.request('/test');

      expect(callOrder).toEqual(['begin', 'handler', 'commit']);
    });

    it('should follow correct error order: begin -> handler -> rollback', async () => {
      const callOrder: string[] = [];

      mockUnitOfWork.begin = vi.fn().mockImplementation(async () => {
        callOrder.push('begin');
      });
      mockUnitOfWork.rollback = vi.fn().mockImplementation(async () => {
        callOrder.push('rollback');
      });

      app.use('*', createUnitOfWorkMiddleware(factory));
      app.get('/test', () => {
        callOrder.push('handler');
        throw new Error('Test error');
      });

      await app.request('/test');

      expect(callOrder).toEqual(['begin', 'handler', 'rollback']);
    });
  });

  describe('Error handling', () => {
    it('should handle factory errors', async () => {
      const errorFactory: UnitOfWorkFactory = async () => {
        throw new Error('Factory error');
      };

      app.use('*', createUnitOfWorkMiddleware(errorFactory));
      app.get('/test', (c) => c.json({ success: true }));

      const response = await app.request('/test');

      expect(response.status).toBe(500);
    });

    it('should handle begin() errors', async () => {
      mockUnitOfWork.begin = vi.fn().mockRejectedValue(new Error('Begin error'));

      app.use('*', createUnitOfWorkMiddleware(factory));
      app.get('/test', (c) => c.json({ success: true }));

      const response = await app.request('/test');

      expect(response.status).toBe(500);
      expect(mockUnitOfWork.commit).not.toHaveBeenCalled();
      expect(mockUnitOfWork.rollback).not.toHaveBeenCalled();
    });

    it('should handle commit() errors', async () => {
      mockUnitOfWork.commit = vi.fn().mockRejectedValue(new Error('Commit error'));

      app.use('*', createUnitOfWorkMiddleware(factory));
      app.get('/test', (c) => c.json({ success: true }));

      const response = await app.request('/test');

      expect(response.status).toBe(500);
      expect(mockUnitOfWork.begin).toHaveBeenCalled();
      // Note: rollback is not called on commit failure
    });

    it('should handle rollback() errors gracefully', async () => {
      mockUnitOfWork.rollback = vi.fn().mockRejectedValue(new Error('Rollback error'));

      app.use('*', createUnitOfWorkMiddleware(factory));
      app.get('/test', () => {
        throw new Error('Handler error');
      });

      const response = await app.request('/test');

      // Should still return 500, but not crash
      expect(response.status).toBe(500);
      expect(mockUnitOfWork.rollback).toHaveBeenCalled();
    });
  });
});
