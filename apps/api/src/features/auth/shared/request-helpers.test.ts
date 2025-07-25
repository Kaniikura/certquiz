/**
 * Request Helpers Tests
 * @fileoverview Unit tests for HTTP request helper functions
 */

import type { Context } from 'hono';
import { describe, expect, it, vi } from 'vitest';
import { safeJson } from './request-helpers';

describe('safeJson', () => {
  it('should return parsed JSON when request is valid', async () => {
    const mockContext = {
      req: {
        json: vi.fn().mockResolvedValue({ email: 'test@example.com', password: 'password123' }),
      },
    } as unknown as Context;

    const result = await safeJson(mockContext);

    expect(result).toEqual({ email: 'test@example.com', password: 'password123' });
    expect(mockContext.req.json).toHaveBeenCalledOnce();
  });

  it('should return null when JSON parsing fails', async () => {
    const mockContext = {
      req: {
        json: vi.fn().mockRejectedValue(new Error('Invalid JSON')),
      },
    } as unknown as Context;

    const result = await safeJson(mockContext);

    expect(result).toBeNull();
    expect(mockContext.req.json).toHaveBeenCalledOnce();
  });

  it('should return null when request has no body', async () => {
    const mockContext = {
      req: {
        json: vi.fn().mockRejectedValue(new Error('No body')),
      },
    } as unknown as Context;

    const result = await safeJson(mockContext);

    expect(result).toBeNull();
  });
});
