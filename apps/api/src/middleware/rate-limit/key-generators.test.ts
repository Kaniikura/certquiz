import type { Context } from 'hono';
import { describe, expect, it, vi } from 'vitest';
import type { AuthUser } from '../auth/auth-user';
import { getCompositeKey, getIpKey, getKeyGenerator, getUserKey } from './key-generators';

describe('Key Generators', () => {
  describe('getIpKey', () => {
    it('should extract IP from X-Forwarded-For header', () => {
      const mockContext = {
        req: {
          header: vi.fn((name: string) => {
            if (name === 'x-forwarded-for') return '192.168.1.1, 10.0.0.1';
            return undefined;
          }),
        },
      } as unknown as Context;

      const key = getIpKey(mockContext);
      expect(key).toBe('ip:192.168.1.1');
      expect(mockContext.req.header).toHaveBeenCalledWith('x-forwarded-for');
    });

    it('should extract first IP from multiple X-Forwarded-For values', () => {
      const mockContext = {
        req: {
          header: vi.fn((name: string) => {
            if (name === 'x-forwarded-for') return '203.0.113.1, 198.51.100.1, 10.0.0.1';
            return undefined;
          }),
        },
      } as unknown as Context;

      const key = getIpKey(mockContext);
      expect(key).toBe('ip:203.0.113.1');
    });

    it('should trim whitespace from IP addresses', () => {
      const mockContext = {
        req: {
          header: vi.fn((name: string) => {
            if (name === 'x-forwarded-for') return '  192.168.1.1  ,  10.0.0.1  ';
            return undefined;
          }),
        },
      } as unknown as Context;

      const key = getIpKey(mockContext);
      expect(key).toBe('ip:192.168.1.1');
    });

    it('should fallback to CF-Connecting-IP header', () => {
      const mockContext = {
        req: {
          header: vi.fn((name: string) => {
            if (name === 'cf-connecting-ip') return '203.0.113.1';
            return undefined;
          }),
        },
      } as unknown as Context;

      const key = getIpKey(mockContext);
      expect(key).toBe('ip:203.0.113.1');
      expect(mockContext.req.header).toHaveBeenCalledWith('x-forwarded-for');
      expect(mockContext.req.header).toHaveBeenCalledWith('cf-connecting-ip');
    });

    it('should fallback to X-Real-IP header', () => {
      const mockContext = {
        req: {
          header: vi.fn((name: string) => {
            if (name === 'x-real-ip') return '198.51.100.1';
            return undefined;
          }),
        },
      } as unknown as Context;

      const key = getIpKey(mockContext);
      expect(key).toBe('ip:198.51.100.1');
      expect(mockContext.req.header).toHaveBeenCalledWith('x-forwarded-for');
      expect(mockContext.req.header).toHaveBeenCalledWith('cf-connecting-ip');
      expect(mockContext.req.header).toHaveBeenCalledWith('x-real-ip');
    });

    it('should return unknown when no IP headers present', () => {
      const mockContext = {
        req: {
          header: vi.fn(() => undefined),
        },
      } as unknown as Context;

      const key = getIpKey(mockContext);
      expect(key).toBe('ip:unknown');
    });

    it('should handle empty header values', () => {
      const mockContext = {
        req: {
          header: vi.fn((name: string) => {
            if (name === 'x-forwarded-for') return '';
            return undefined;
          }),
        },
      } as unknown as Context;

      const key = getIpKey(mockContext);
      expect(key).toBe('ip:unknown');
    });

    it('should handle null header values', () => {
      const mockContext = {
        req: {
          header: vi.fn(() => null),
        },
      } as unknown as Context;

      const key = getIpKey(mockContext);
      expect(key).toBe('ip:unknown');
    });
  });

  describe('getUserKey', () => {
    it('should extract user ID from authenticated context', () => {
      const mockUser: AuthUser = {
        sub: 'user-123',
        email: 'test@example.com',
        roles: ['user'],
      };

      const mockContext = {
        get: vi.fn((name: string) => {
          if (name === 'user') return mockUser;
          return undefined;
        }),
      } as unknown as Context;

      const key = getUserKey(mockContext);
      expect(key).toBe('user:user-123');
      expect(mockContext.get).toHaveBeenCalledWith('user');
    });

    it('should handle anonymous users (no user in context)', () => {
      const mockContext = {
        get: vi.fn(() => undefined),
      } as unknown as Context;

      const key = getUserKey(mockContext);
      expect(key).toBe('user:anonymous');
    });

    it('should handle null user value', () => {
      const mockContext = {
        get: vi.fn(() => null),
      } as unknown as Context;

      const key = getUserKey(mockContext);
      expect(key).toBe('user:anonymous');
    });

    it('should handle user without sub field', () => {
      const mockContext = {
        get: vi.fn((name: string) => {
          if (name === 'user') return {} as AuthUser; // Invalid user object
          return undefined;
        }),
      } as unknown as Context;

      const key = getUserKey(mockContext);
      expect(key).toBe('user:anonymous');
    });

    it('should handle user with empty sub field', () => {
      const mockUser = {
        sub: '',
        email: 'test@example.com',
        roles: ['user'],
      } as AuthUser;

      const mockContext = {
        get: vi.fn((name: string) => {
          if (name === 'user') return mockUser;
          return undefined;
        }),
      } as unknown as Context;

      const key = getUserKey(mockContext);
      expect(key).toBe('user:anonymous');
    });
  });

  describe('getCompositeKey', () => {
    it('should create user-path composite key for authenticated users', () => {
      const mockUser: AuthUser = {
        sub: 'user-123',
        email: 'test@example.com',
        roles: ['user'],
      };

      const mockContext = {
        get: vi.fn((name: string) => {
          if (name === 'user') return mockUser;
          return undefined;
        }),
        req: {
          path: '/api/quiz/start',
        },
      } as unknown as Context;

      const key = getCompositeKey(mockContext, 'user');
      expect(key).toBe('user:user-123:path:/api/quiz/start');
    });

    it('should create ip-path composite key for IP-based limiting', () => {
      const mockContext = {
        req: {
          header: vi.fn((name: string) => {
            if (name === 'x-forwarded-for') return '192.168.1.1';
            return undefined;
          }),
          path: '/api/auth/login',
        },
      } as unknown as Context;

      const key = getCompositeKey(mockContext, 'ip');
      expect(key).toBe('ip:192.168.1.1:path:/api/auth/login');
    });

    it('should handle anonymous user in composite key', () => {
      const mockContext = {
        get: vi.fn(() => undefined),
        req: {
          path: '/api/public/data',
        },
      } as unknown as Context;

      const key = getCompositeKey(mockContext, 'user');
      expect(key).toBe('user:anonymous:path:/api/public/data');
    });

    it('should handle paths with query parameters', () => {
      const mockContext = {
        req: {
          header: vi.fn((name: string) => {
            if (name === 'x-forwarded-for') return '192.168.1.1';
            return undefined;
          }),
          path: '/api/search?q=test&page=1',
        },
      } as unknown as Context;

      const key = getCompositeKey(mockContext, 'ip');
      expect(key).toBe('ip:192.168.1.1:path:/api/search?q=test&page=1');
    });

    it('should handle root path', () => {
      const mockContext = {
        req: {
          header: vi.fn((name: string) => {
            if (name === 'x-forwarded-for') return '192.168.1.1';
            return undefined;
          }),
          path: '/',
        },
      } as unknown as Context;

      const key = getCompositeKey(mockContext, 'ip');
      expect(key).toBe('ip:192.168.1.1:path:/');
    });
  });

  describe('getKeyGenerator', () => {
    it('should return getIpKey function for "ip" type', () => {
      const generator = getKeyGenerator('ip');
      expect(generator).toBe(getIpKey);

      // Verify it works correctly
      const mockContext = {
        req: {
          header: vi.fn((name: string) => {
            if (name === 'x-forwarded-for') return '192.168.1.1';
            return undefined;
          }),
        },
      } as unknown as Context;

      expect(generator(mockContext)).toBe('ip:192.168.1.1');
    });

    it('should return getUserKey function for "user" type', () => {
      const generator = getKeyGenerator('user');
      expect(generator).toBe(getUserKey);

      // Verify it works correctly
      const mockUser: AuthUser = {
        sub: 'user-456',
        email: 'test@example.com',
        roles: ['user'],
      };

      const mockContext = {
        get: vi.fn((name: string) => {
          if (name === 'user') return mockUser;
          return undefined;
        }),
      } as unknown as Context;

      expect(generator(mockContext)).toBe('user:user-456');
    });

    it('should throw an error for invalid type', () => {
      // @ts-expect-error - Testing runtime error handling
      expect(() => getKeyGenerator('invalid')).toThrow('Invalid key generator type: invalid');
    });
  });
});
