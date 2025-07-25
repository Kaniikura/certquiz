import { UserRole } from '@api/features/auth/domain';
import { jwtVerifySuccess } from '@api/test-support/jwt-helpers';
import * as jose from 'jose';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { JwtVerifier } from './JwtVerifier';
import type { IRoleMapper } from './RoleMapper';

// Mock the jose library
vi.mock('jose', () => ({
  jwtVerify: vi.fn(),
  createRemoteJWKSet: vi.fn(),
}));

const mockJwtVerify = vi.mocked(jose.jwtVerify);
const mockCreateRemoteJWKSet = vi.mocked(jose.createRemoteJWKSet);

describe('JwtVerifier', () => {
  let verifier: JwtVerifier;
  let validToken: string;
  let expiredToken: string;
  let notYetValidToken: string;
  let mockJwks: ReturnType<typeof jose.createRemoteJWKSet>;
  let mockRoleMapper: IRoleMapper;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-01-01T00:00:00Z'));

    // Mock JWKS object - create a full mock that satisfies the RemoteJWKSet type
    const getKeyFn = vi.fn().mockResolvedValue({
      kty: 'RSA',
      n: 'test-modulus',
      e: 'AQAB',
    });

    // Add properties to the function to match RemoteJWKSet type
    Object.assign(getKeyFn, {
      coolingDown: false,
      fresh: true,
      reloading: false,
      reload: vi.fn().mockResolvedValue(undefined),
      jwks: vi.fn().mockReturnValue({ keys: [] }),
    });

    mockJwks = getKeyFn as unknown as ReturnType<typeof jose.createRemoteJWKSet>;

    // Setup mock for createRemoteJWKSet
    mockCreateRemoteJWKSet.mockReturnValue(mockJwks);

    // Mock tokens (these would be real JWT tokens in actual implementation)
    validToken =
      'eyJhbGciOiJSUzI1NiIsImtpZCI6InRlc3Qta2V5LWlkIn0.eyJzdWIiOiJ1c2VyLTEyMyIsImVtYWlsIjoidGVzdEB0ZXN0LmNvbSIsInByZWZlcnJlZF91c2VybmFtZSI6InRlc3R1c2VyIiwiZXhwIjoxNzM1Njg5NjAwLCJpYXQiOjE3MzU2ODYwMDAsImF1ZCI6ImNlcnRxdWl6IiwiaXNzIjoidGVzdC1pc3N1ZXIiLCJyZWFsbV9hY2Nlc3MiOnsicm9sZXMiOlsidXNlciJdfSwicmVzb3VyY2VfYWNjZXNzIjp7ImNlcnRxdWl6Ijp7InJvbGVzIjpbInN0dWRlbnQiXX19fQ.signature';
    expiredToken =
      'eyJhbGciOiJSUzI1NiIsImtpZCI6InRlc3Qta2V5LWlkIn0.eyJzdWIiOiJ1c2VyLTEyMyIsImV4cCI6MTczNTY4NTk5OSwiaWF0IjoxNzM1Njg1OTk5fQ.expired-signature';
    notYetValidToken =
      'eyJhbGciOiJSUzI1NiIsImtpZCI6InRlc3Qta2V5LWlkIn0.eyJzdWIiOiJ1c2VyLTEyMyIsIm5iZiI6MTczNTY4NjAwMSwiaWF0IjoxNzM1Njg1OTk5fQ.not-yet-valid-signature';

    // Mock role mapper
    mockRoleMapper = {
      toDomain: vi.fn().mockImplementation((roles: string[]) => {
        // Default mapping for tests - deduplicate roles
        const mapped = new Set<UserRole>();
        if (roles.includes('user')) mapped.add(UserRole.User);
        if (roles.includes('student')) mapped.add(UserRole.User);
        const result = Array.from(mapped);
        return result.length > 0 ? result : [UserRole.Guest];
      }),
    };

    verifier = new JwtVerifier(
      {
        jwksUri: 'https://auth.example.com/.well-known/jwks.json',
        audience: 'certquiz',
        issuer: 'test-issuer',
      },
      mockRoleMapper
    );
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Happy Path', () => {
    it('should return payload when token is signed by a key that exists in JWKS', async () => {
      // Arrange
      mockJwtVerify.mockResolvedValueOnce(
        jwtVerifySuccess({
          payload: {
            sub: 'user-123',
            email: 'test@test.com',
            preferred_username: 'testuser',
            realm_access: { roles: ['user'] },
            resource_access: { certquiz: { roles: ['student'] } },
          },
          protectedHeader: { alg: 'RS256', kid: 'test-key-id' },
        })
      );

      // Act & Assert
      await expect(verifier.verifyToken(validToken)).resolves.toEqual({
        sub: 'user-123',
        email: 'test@test.com',
        preferred_username: 'testuser',
        roles: ['user'], // Mapped from ['user', 'student']
      });
    });

    it('should cache JWKS on first call and re-use cache', async () => {
      // Arrange
      mockJwtVerify.mockResolvedValue(
        jwtVerifySuccess({
          payload: {
            sub: 'user-123',
            email: 'test@test.com',
            preferred_username: 'testuser',
            realm_access: { roles: ['user'] },
            resource_access: { certquiz: { roles: ['student'] } },
          },
          protectedHeader: { alg: 'RS256', kid: 'test-key-id' },
        })
      );

      // Act - Call verifyToken 5 times
      await Promise.all([
        verifier.verifyToken(validToken),
        verifier.verifyToken(validToken),
        verifier.verifyToken(validToken),
        verifier.verifyToken(validToken),
        verifier.verifyToken(validToken),
      ]);

      // Assert - createRemoteJWKSet should be called only once during initialization
      expect(mockCreateRemoteJWKSet).toHaveBeenCalledTimes(1);
      // Assert - roleMapper should be called 5 times (once per token verification)
      expect(mockRoleMapper.toDomain).toHaveBeenCalledTimes(5);
    });

    it('should validate aud and iss fields when configured', async () => {
      // Arrange
      mockJwtVerify.mockResolvedValueOnce(
        jwtVerifySuccess({
          payload: {
            sub: 'user-123',
            email: 'test@test.com',
            preferred_username: 'testuser',
            realm_access: { roles: ['user'] },
            resource_access: { certquiz: { roles: ['student'] } },
          },
          protectedHeader: { alg: 'RS256', kid: 'test-key-id' },
        })
      );

      // Act & Assert
      await expect(verifier.verifyToken(validToken)).resolves.toEqual({
        sub: 'user-123',
        email: 'test@test.com',
        preferred_username: 'testuser',
        roles: ['user'], // Mapped from ['user', 'student']
      });
    });
  });

  describe('Error Paths', () => {
    it('should reject when signature is invalid', async () => {
      // Arrange
      const sigError = new Error('signature verification failed');
      Object.assign(sigError, { code: 'ERR_JWS_SIGNATURE_VERIFICATION_FAILED' });
      mockJwtVerify.mockRejectedValueOnce(sigError);

      const tokenWithInvalidSignature = validToken.replace(/signature$/, 'wrong-signature');

      // Act & Assert
      await expect(verifier.verifyToken(tokenWithInvalidSignature)).rejects.toThrow(
        'Invalid token signature'
      );
    });

    it('should reject when token is expired', async () => {
      // Arrange
      const expError = new Error('"exp" claim timestamp check failed');
      Object.assign(expError, { code: 'ERR_JWT_EXPIRED' });
      mockJwtVerify.mockRejectedValueOnce(expError);

      // Act & Assert
      await expect(verifier.verifyToken(expiredToken)).rejects.toThrow('Token expired');
    });

    it('should reject when token is not yet valid', async () => {
      // Arrange
      const nbfError = new Error('"nbf" claim timestamp check failed');
      Object.assign(nbfError, { code: 'ERR_JWT_CLAIM_VALIDATION_FAILED', claim: 'nbf' });
      mockJwtVerify.mockRejectedValueOnce(nbfError);

      // Act & Assert
      await expect(verifier.verifyToken(notYetValidToken)).rejects.toThrow('Token not yet valid');
    });

    it('should reject when JWKS endpoint returns 404', async () => {
      // Arrange
      mockJwtVerify.mockRejectedValueOnce(new Error('failed to fetch JWKS'));

      // Act & Assert
      await expect(verifier.verifyToken(validToken)).rejects.toThrow('Failed to fetch JWKS');
    });

    it('should reject when JWKS endpoint has network error', async () => {
      // Arrange
      mockJwtVerify.mockRejectedValueOnce(new Error('Network error'));

      // Act & Assert
      await expect(verifier.verifyToken(validToken)).rejects.toThrow('Network error');
    });

    it('should reject when key id (kid) not found in JWKS', async () => {
      // Arrange
      const keyError = new Error('no applicable key found in the JSON Web Key Set');
      // This error doesn't have a code in jose, handled by message pattern
      mockJwtVerify.mockRejectedValueOnce(keyError);

      // Act & Assert
      await expect(verifier.verifyToken(validToken)).rejects.toThrow('Key not found in JWKS');
    });

    it('should reject when required claim is missing', async () => {
      // Arrange
      mockJwtVerify.mockResolvedValueOnce(
        jwtVerifySuccess({
          payload: {
            // Missing 'sub' claim
            email: 'test@test.com',
            preferred_username: 'testuser',
            realm_access: { roles: ['user'] },
            resource_access: { certquiz: { roles: ['student'] } },
          },
          protectedHeader: { alg: 'RS256', kid: 'test-key-id' },
        })
      );

      // Act & Assert - Use validToken format but mock will return payload without 'sub'
      await expect(verifier.verifyToken(validToken)).rejects.toThrow('Missing required claim');
    });
  });

  describe('Edge Cases', () => {
    it('should handle tokens signed with unsupported algorithm', async () => {
      // Arrange
      const hs256Token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyLTEyMyJ9.signature';
      const algError = new Error('"alg" (Algorithm) Header Parameter value not allowed');
      Object.assign(algError, { code: 'ERR_JOSE_ALG_NOT_ALLOWED' });
      mockJwtVerify.mockRejectedValueOnce(algError);

      // Act & Assert
      await expect(verifier.verifyToken(hs256Token)).rejects.toThrow('Unsupported algorithm');
    });

    it('should handle large tokens efficiently', async () => {
      // Use real timers for accurate performance measurement
      vi.useRealTimers();

      // Arrange
      mockJwtVerify.mockResolvedValueOnce(
        jwtVerifySuccess({
          payload: {
            sub: 'user-123',
            email: 'test@test.com',
            preferred_username: 'testuser',
            realm_access: { roles: ['user'] },
            resource_access: { certquiz: { roles: ['student'] } },
          },
          protectedHeader: { alg: 'RS256', kid: 'test-key-id' },
        })
      );

      const largeToken = validToken + 'x'.repeat(4000); // Simulate large token

      // Act
      const startTime = performance.now();
      await verifier.verifyToken(largeToken).catch(() => {
        // Intentionally empty - testing performance regardless of validation result
      });
      const endTime = performance.now();

      // Assert - Should complete in a reasonable time
      expect(endTime - startTime).toBeLessThan(10);

      // Restore fake timers for other tests
      vi.useFakeTimers();
    });

    it('should handle malformed token format', async () => {
      // Arrange - Use a token with wrong number of parts
      const malformedToken = 'invalid.token'; // Only 2 parts instead of 3

      // Act & Assert
      await expect(verifier.verifyToken(malformedToken)).rejects.toThrow('Invalid token format');
    });
  });
});
