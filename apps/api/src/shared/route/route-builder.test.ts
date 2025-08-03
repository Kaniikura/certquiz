/**
 * Unit tests for route-builder
 */

import { Result } from '@api/shared/result';
import type { Context } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { type AmbientRouteConfig, createAmbientRoute } from './route-builder';

describe('createAmbientRoute', () => {
  let mockLogger: {
    info: ReturnType<typeof vi.fn>;
    error: ReturnType<typeof vi.fn>;
    warn: ReturnType<typeof vi.fn>;
  };
  let mockContext: Context;

  beforeEach(() => {
    mockLogger = {
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
    };

    mockContext = {
      get: vi.fn((key: string) => {
        if (key === 'logger') return mockLogger;
        if (key === 'user') return undefined;
        return undefined;
      }),
      req: {
        json: vi.fn().mockResolvedValue({}),
      },
      json: vi
        .fn()
        .mockImplementation((data, status) => new Response(JSON.stringify(data), { status })),
    } as unknown as Context;
  });

  describe('Authentication Configuration', () => {
    it('should return error response when requiresAuth is undefined', async () => {
      const config: Omit<AmbientRouteConfig, 'requiresAuth'> & { requiresAuth?: boolean } = {
        operation: 'get',
        resource: 'test',
        // requiresAuth is intentionally omitted (undefined)
        errorMapper: (error) => ({
          status: 500,
          body: new Response(JSON.stringify({ error: error.message }), { status: 500 }),
        }),
      };

      const handler = vi.fn().mockResolvedValue(Result.ok({ message: 'test' }));
      const route = createAmbientRoute(config as AmbientRouteConfig, handler);

      const response = await route(mockContext, {});

      // Should return 500 error response with the error message
      expect(response.status).toBe(500);
      const body = await response.json();
      expect(body.error).toBe(
        'Route config must explicitly set requiresAuth (true or false). ' +
          'This prevents accidental public access. For public routes, set requiresAuth: false. ' +
          'For protected routes, set requiresAuth: true.'
      );

      // Handler should not be called because error occurs before handler execution
      expect(handler).not.toHaveBeenCalled();
    });

    it('should work correctly when requiresAuth is explicitly set to true', async () => {
      const config: AmbientRouteConfig = {
        operation: 'get',
        resource: 'test',
        requiresAuth: true,
        errorMapper: (error) => ({
          status: 500,
          body: new Response(JSON.stringify({ error: error.message }), { status: 500 }),
        }),
      };

      const handler = vi.fn().mockResolvedValue(Result.ok({ message: 'test' }));
      const route = createAmbientRoute(config, handler);

      const response = await route(mockContext, {});

      // Should return 401 because no user is set (requiresAuth: true but no user)
      expect(response.status).toBe(401);
    });

    it('should work correctly when requiresAuth is explicitly set to false', async () => {
      const config: AmbientRouteConfig = {
        operation: 'get',
        resource: 'test',
        requiresAuth: false,
        errorMapper: (error) => ({
          status: 500,
          body: new Response(JSON.stringify({ error: error.message }), { status: 500 }),
        }),
      };

      const handler = vi.fn().mockResolvedValue(Result.ok({ message: 'test' }));
      const route = createAmbientRoute(config, handler);

      const response = await route(mockContext, {});

      // Should succeed because requiresAuth: false (public route)
      expect(response.status).toBe(200);
      expect(handler).toHaveBeenCalled();
    });

    it('should allow authenticated users when requiresAuth is true', async () => {
      const mockUser = { sub: 'user-123', roles: ['user'] };
      (mockContext.get as ReturnType<typeof vi.fn>).mockImplementation((key: string) => {
        if (key === 'logger') return mockLogger;
        if (key === 'user') return mockUser;
        return undefined;
      });

      const config: AmbientRouteConfig = {
        operation: 'get',
        resource: 'test',
        requiresAuth: true,
        errorMapper: (error) => ({
          status: 500,
          body: new Response(JSON.stringify({ error: error.message }), { status: 500 }),
        }),
      };

      const handler = vi.fn().mockResolvedValue(Result.ok({ message: 'test' }));
      const route = createAmbientRoute(config, handler);

      const response = await route(mockContext, {});

      // Should succeed because user is authenticated
      expect(response.status).toBe(200);
      expect(handler).toHaveBeenCalled();
    });
  });
});
