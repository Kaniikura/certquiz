import { _resetJwtVerifierCache } from '@api/middleware/auth';
import type * as jose from 'jose';

type JwtVerifySuccess<Payload = jose.JWTPayload> = Awaited<ReturnType<typeof jose.jwtVerify>> & {
  payload: Payload;
};

/**
 * Build a value that satisfies the return type of jose.jwtVerify
 * while letting the test supply only the interesting bits.
 */
export function jwtVerifySuccess<Payload>(
  partial: Omit<JwtVerifySuccess<Payload>, 'key'>
): JwtVerifySuccess<Payload> {
  return {
    key: {} as never, // dummy KeyLike – never used in the test
    ...partial,
  } as JwtVerifySuccess<Payload>;
}

/**
 * Resets the JWT verifier cache for testing purposes.
 * This function should only be used in test files to ensure clean state between tests.
 * @throws {Error} If called outside of test environment
 */
export function resetJwtVerifierCache(): void {
  if (process.env.NODE_ENV !== 'test') {
    throw new Error('resetJwtVerifierCache can only be used in test environment');
  }

  _resetJwtVerifierCache();
}
