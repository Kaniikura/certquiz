import type * as jose from 'jose';

export type JwtVerifySuccess<Payload = jose.JWTPayload> = Awaited<
  ReturnType<typeof jose.jwtVerify>
> & { payload: Payload };

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
