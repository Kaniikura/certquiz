import { JwtVerifier } from '@api/infra/auth/JwtVerifier';
import { Hono } from 'hono';
import { afterEach, beforeEach, describe, expect, expectTypeOf, it, vi } from 'vitest';
import { auth } from './auth';
import type { AuthUser } from './auth/auth-user';

// Mock JwtVerifier at module level
vi.mock('@api/infra/auth/JwtVerifier');

describe('auth() middleware', () => {
  let app: Hono<{ Variables: { user?: AuthUser } }>;
  const mockVerifier = vi.mocked(JwtVerifier.prototype);
  const mockJwtVerifierConstructor = vi.mocked(JwtVerifier);

  beforeEach(() => {
    vi.clearAllMocks();
    app = new Hono<{ Variables: { user?: AuthUser } }>();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // Helper to mock verification result
  const mockVerify = (result: AuthUser | Error) => {
    mockVerifier.verifyToken.mockImplementation(async () => {
      if (result instanceof Error) {
        throw result;
      }
      return result;
    });
  };

  // Test user fixtures
  const validUser: AuthUser = {
    sub: 'user-123',
    email: 'test@example.com',
    preferred_username: 'testuser',
    roles: ['user'],
  };

  const adminUser: AuthUser = {
    sub: 'admin-456',
    email: 'admin@example.com',
    preferred_username: 'adminuser',
    roles: ['user', 'admin'],
  };

  describe('Happy paths', () => {
    it('should store user in context and call next() for valid Bearer token', async () => {
      // Arrange
      mockVerify(validUser);
      let capturedUser: AuthUser | undefined;

      app.use(auth());
      app.get('/test', (c) => {
        capturedUser = c.get('user');
        return c.text('OK');
      });

      // Act
      const res = await app.request('/test', {
        headers: { Authorization: 'Bearer valid.jwt.token' },
      });

      // Assert
      expect(res.status).toBe(200);
      expect(await res.text()).toBe('OK');
      expect(capturedUser).toEqual(validUser);
      expect(mockVerifier.verifyToken).toHaveBeenCalledWith('valid.jwt.token');
    });

    it('should allow access when user has required role', async () => {
      // Arrange
      mockVerify(adminUser);

      app.use(auth({ roles: ['admin'] }));
      app.get('/test', (c) => c.text('Admin access granted'));

      // Act
      const res = await app.request('/test', {
        headers: { Authorization: 'Bearer admin.jwt.token' },
      });

      // Assert
      expect(res.status).toBe(200);
      expect(await res.text()).toBe('Admin access granted');
    });

    it('should allow request without token when required is false', async () => {
      // Arrange
      let capturedUser: AuthUser | undefined;

      app.use(auth({ required: false }));
      app.get('/test', (c) => {
        capturedUser = c.get('user');
        return c.text('OK');
      });

      // Act
      const res = await app.request('/test'); // No auth header

      // Assert
      expect(res.status).toBe(200);
      expect(capturedUser).toBeUndefined();
      expect(mockVerifier.verifyToken).not.toHaveBeenCalled();
    });

    it('should allow request with malformed header when required is false', async () => {
      // Arrange
      let capturedUser: AuthUser | undefined;

      app.use(auth({ required: false }));
      app.get('/test', (c) => {
        capturedUser = c.get('user');
        return c.text('OK');
      });

      // Act
      const res = await app.request('/test', {
        headers: { Authorization: 'Invalid header format' },
      });

      // Assert
      expect(res.status).toBe(200);
      expect(capturedUser).toBeUndefined();
      expect(mockVerifier.verifyToken).not.toHaveBeenCalled();
    });

    it('should handle multiple required roles when all are satisfied', async () => {
      // Arrange
      const multiRoleUser: AuthUser = {
        sub: 'multi-789',
        roles: ['user', 'admin', 'staff'],
      };
      mockVerify(multiRoleUser);

      app.use(auth({ roles: ['admin', 'staff'] }));
      app.get('/test', (c) => c.text('Multi-role access granted'));

      // Act
      const res = await app.request('/test', {
        headers: { Authorization: 'Bearer multi.jwt.token' },
      });

      // Assert
      expect(res.status).toBe(200);
      expect(await res.text()).toBe('Multi-role access granted');
    });
  });

  describe('Authentication failures', () => {
    it('should return 401 when Authorization header is missing (required=true)', async () => {
      // Arrange
      app.use(auth()); // Default: required=true
      app.get('/test', (c) => c.text('Should not reach here'));

      // Act
      const res = await app.request('/test'); // No auth header

      // Assert
      expect(res.status).toBe(401);
      const body = await res.json();
      expect(body).toEqual({ error: 'Authentication required' });
    });

    const invalidHeaders = ['', 'Basic xyz', 'Bearer', 'Bearer ', 'Bearer\t', 'Random abc'];
    it.each(invalidHeaders)('should return 401 for invalid header: "%s"', async (header) => {
      // Arrange
      app = new Hono<{ Variables: { user?: AuthUser } }>(); // Reset app for each test
      app.use(auth());
      app.get('/test', (c) => c.text('Should not reach here'));

      // Act
      const res = await app.request('/test', {
        headers: { Authorization: header },
      });

      // Assert
      expect(res.status).toBe(401);
      const body = await res.json();
      expect(body).toEqual({ error: 'Invalid authorization format' });
    });

    it('should return 401 when token verification fails with expired token', async () => {
      // Arrange
      mockVerify(new Error('Token expired'));
      app.use(auth());
      app.get('/test', (c) => c.text('Should not reach here'));

      // Act
      const res = await app.request('/test', {
        headers: { Authorization: 'Bearer expired.jwt.token' },
      });

      // Assert
      expect(res.status).toBe(401);
      const body = await res.json();
      expect(body).toEqual({ error: 'Token expired' });
    });

    it('should return 401 when token verification fails with invalid token', async () => {
      // Arrange
      mockVerify(new Error('Invalid token signature'));
      app.use(auth());
      app.get('/test', (c) => c.text('Should not reach here'));

      // Act
      const res = await app.request('/test', {
        headers: { Authorization: 'Bearer invalid.jwt.token' },
      });

      // Assert
      expect(res.status).toBe(401);
      const body = await res.json();
      expect(body).toEqual({ error: 'Invalid token signature' });
    });

    it('should return 500 when JwtVerifier throws unexpected error', async () => {
      // Arrange
      mockVerify(new Error('Unexpected error'));
      app.use(auth());
      app.get('/test', (c) => c.text('Should not reach here'));

      // Act
      const res = await app.request('/test', {
        headers: { Authorization: 'Bearer problematic.jwt.token' },
      });

      // Assert
      expect(res.status).toBe(500);
      const body = await res.json();
      expect(body).toEqual({ error: 'Internal server error' });
    });
  });

  describe('Authorization failures', () => {
    it('should return 403 when user has no roles but middleware requires roles', async () => {
      // Arrange
      const userNoRoles: AuthUser = {
        sub: 'norole-999',
        roles: [],
      };
      mockVerify(userNoRoles);
      app.use(auth({ roles: ['admin'] }));
      app.get('/test', (c) => c.text('Should not reach here'));

      // Act
      const res = await app.request('/test', {
        headers: { Authorization: 'Bearer norole.jwt.token' },
      });

      // Assert
      expect(res.status).toBe(403);
      const body = await res.json();
      expect(body).toEqual({ error: 'Insufficient permissions' });
    });

    it('should return 403 when user lacks required role', async () => {
      // Arrange
      mockVerify(validUser); // Has 'user' role only
      app.use(auth({ roles: ['admin'] }));
      app.get('/test', (c) => c.text('Should not reach here'));

      // Act
      const res = await app.request('/test', {
        headers: { Authorization: 'Bearer user.jwt.token' },
      });

      // Assert
      expect(res.status).toBe(403);
      const body = await res.json();
      expect(body).toEqual({ error: 'Insufficient permissions' });
    });

    it('should return 403 when user lacks any of multiple required roles', async () => {
      // Arrange
      mockVerify(adminUser); // Has 'user' and 'admin'
      app.use(auth({ roles: ['admin', 'superadmin'] }));
      app.get('/test', (c) => c.text('Should not reach here'));

      // Act
      const res = await app.request('/test', {
        headers: { Authorization: 'Bearer admin.jwt.token' },
      });

      // Assert
      expect(res.status).toBe(403);
      const body = await res.json();
      expect(body).toEqual({ error: 'Insufficient permissions' });
    });
  });

  describe('Context behavior', () => {
    it('should set user in context matching verifier output exactly', async () => {
      // Arrange
      const detailedUser: AuthUser = {
        sub: 'detailed-111',
        email: 'detailed@example.com',
        preferred_username: 'detaileduser',
        roles: ['user', 'premium', 'beta-tester'],
      };
      mockVerify(detailedUser);
      let capturedUser: AuthUser | undefined;

      app.use(auth());
      app.get('/test', (c) => {
        capturedUser = c.get('user');
        return c.text('OK');
      });

      // Act
      const res = await app.request('/test', {
        headers: { Authorization: 'Bearer detailed.jwt.token' },
      });

      // Assert
      expect(res.status).toBe(200);
      expect(capturedUser).toStrictEqual(detailedUser);
      expect(capturedUser).toBe(await mockVerifier.verifyToken.mock.results[0]?.value);
    });

    it('should type ctx.var.user as AuthUser | undefined', async () => {
      // Arrange
      mockVerify(validUser);

      app.use(auth());
      app.get('/test', (c) => {
        // Type-level test
        expectTypeOf(c.get('user')).toEqualTypeOf<AuthUser | undefined>();
        return c.text('OK');
      });

      // Act
      const res = await app.request('/test', {
        headers: { Authorization: 'Bearer valid.jwt.token' },
      });

      // Assert
      expect(res.status).toBe(200);
    });
  });

  describe('Edge cases', () => {
    it('should handle authorization header with different casing', async () => {
      // Arrange
      mockVerify(validUser);
      app.use(auth());
      app.get('/test', (c) => c.text('OK'));

      // Act
      const res = await app.request('/test', {
        headers: { authorization: 'Bearer case.jwt.token' }, // lowercase
      });

      // Assert
      expect(res.status).toBe(200);
      expect(mockVerifier.verifyToken).toHaveBeenCalledWith('case.jwt.token');
    });

    it('should trim extra spaces in Bearer token', async () => {
      // Arrange
      mockVerify(validUser);
      app.use(auth());
      app.get('/test', (c) => c.text('OK'));

      // Act
      const res = await app.request('/test', {
        headers: { Authorization: 'Bearer    spaces.jwt.token' }, // Multiple spaces
      });

      // Assert
      expect(res.status).toBe(200);
      expect(mockVerifier.verifyToken).toHaveBeenCalledWith('spaces.jwt.token');
    });

    it('should handle empty roles array in auth options', async () => {
      // Arrange
      mockVerify(validUser);
      app.use(auth({ roles: [] })); // Empty roles = no role requirement
      app.get('/test', (c) => c.text('OK'));

      // Act
      const res = await app.request('/test', {
        headers: { Authorization: 'Bearer valid.jwt.token' },
      });

      // Assert
      expect(res.status).toBe(200);
    });

    it('should instantiate JwtVerifier with correct options', async () => {
      // Arrange
      mockVerify(validUser);
      app.use(auth());
      app.get('/test', (c) => c.text('OK'));

      // Act
      const res = await app.request('/test', {
        headers: { Authorization: 'Bearer valid.jwt.token' },
      });

      // Assert
      expect(res.status).toBe(200);
      expect(mockJwtVerifierConstructor).toHaveBeenCalledWith({
        jwksUri: expect.any(String),
        audience: expect.any(String),
        issuer: expect.any(String),
      });
    });
  });

  describe('Performance', () => {
    it('should complete middleware execution in reasonable time', async () => {
      // Arrange
      vi.useRealTimers();
      mockVerify(validUser);
      app.use(auth());
      app.get('/test', (c) => c.text('OK'));

      // Act
      const start = performance.now();
      const res = await app.request('/test', {
        headers: { Authorization: 'Bearer perf.jwt.token' },
      });
      const end = performance.now();

      // Assert
      expect(res.status).toBe(200);
      expect(end - start).toBeLessThan(10); // Should complete in less than 10ms
      vi.useFakeTimers();
    });

    it('should not call verifyToken when auth is optional and no header provided', async () => {
      // Arrange
      app.use(auth({ required: false }));
      app.get('/test', (c) => c.text('OK'));

      // Act
      const res = await app.request('/test'); // No header

      // Assert
      expect(res.status).toBe(200);
      expect(mockVerifier.verifyToken).not.toHaveBeenCalled();
    });
  });
});
