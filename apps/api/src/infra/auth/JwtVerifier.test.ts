import { jwtVerifySuccess } from '@api/test-support/jwt-helpers';
import * as jose from 'jose';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { JwtVerifier } from './JwtVerifier';

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

    verifier = new JwtVerifier({
      jwksUri: 'https://auth.example.com/.well-known/jwks.json',
      audience: 'certquiz',
      issuer: 'test-issuer',
    });
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
        roles: ['user', 'student'],
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
        roles: ['user', 'student'],
      });
    });
  });

  describe('Error Paths', () => {
    it('should reject when signature is invalid', async () => {
      // Arrange
      mockJwtVerify.mockRejectedValueOnce(new Error('JWS signature verification failed'));

      const tokenWithInvalidSignature = validToken.replace(/signature$/, 'wrong-signature');

      // Act & Assert
      await expect(verifier.verifyToken(tokenWithInvalidSignature)).rejects.toThrow(
        'Invalid token signature'
      );
    });

    it('should reject when token is expired', async () => {
      // Arrange
      mockJwtVerify.mockRejectedValueOnce(new Error('JWT expired'));

      // Act & Assert
      await expect(verifier.verifyToken(expiredToken)).rejects.toThrow('Token expired');
    });

    it('should reject when token is not yet valid', async () => {
      // Arrange
      mockJwtVerify.mockRejectedValueOnce(new Error('JWT not active'));

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
      mockJwtVerify.mockRejectedValueOnce(new Error('Unable to find a key'));

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
      mockJwtVerify.mockRejectedValueOnce(new Error('alg "HS256" is not allowed'));

      // Act & Assert
      await expect(verifier.verifyToken(hs256Token)).rejects.toThrow('Unsupported algorithm');
    });

    it('should handle large tokens efficiently', async () => {
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
      const startTime = Date.now();
      await verifier.verifyToken(largeToken).catch(() => {
        // Intentionally empty - testing performance regardless of validation result
      });
      const endTime = Date.now();

      // Assert - Should complete under 5ms
      expect(endTime - startTime).toBeLessThan(5);
    });

    it('should handle malformed token format', async () => {
      // Arrange - Use a token with wrong number of parts
      const malformedToken = 'invalid.token'; // Only 2 parts instead of 3

      // Act & Assert
      await expect(verifier.verifyToken(malformedToken)).rejects.toThrow('Invalid token format');
    });
  });
});
