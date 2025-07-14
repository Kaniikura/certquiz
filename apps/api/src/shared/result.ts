/**
 * Result type for functional error handling
 * Inspired by Rust's Result<T, E> type
 */

export type Result<T, E = Error> = { success: true; data: T } | { success: false; error: E };

function okOverload<T>(data: T): Result<T, never>;
function okOverload(): Result<void, never>;
function okOverload<T>(...data: [T] | []): Result<T, never> | Result<void, never> {
  if (data.length === 0) {
    return { success: true } as Result<void, never>;
  } else {
    return { success: true, data: data[0] } as Result<T, never>;
  }
}

export const Result = {
  ok: okOverload,

  err<E>(error: E): Result<never, E> {
    return { success: false, error };
  },

  // Alias for design document compatibility
  fail<E>(error: E): Result<never, E> {
    return { success: false, error };
  },

  isOk<T, E>(result: Result<T, E>): result is { success: true; data: T } {
    return result.success;
  },

  isErr<T, E>(result: Result<T, E>): result is { success: false; error: E } {
    return !result.success;
  },

  map<T, U, E>(result: Result<T, E>, fn: (value: T) => U): Result<U, E> {
    if (result.success) {
      return Result.ok(fn(result.data));
    }
    return result;
  },

  mapErr<T, E, F>(result: Result<T, E>, fn: (error: E) => F): Result<T, F> {
    if (!result.success) {
      return Result.err(fn(result.error));
    }
    return result;
  },

  unwrap<T, E>(result: Result<T, E>): T {
    if (result.success) {
      return result.data;
    }
    throw result.error;
  },

  unwrapOr<T, E>(result: Result<T, E>, defaultValue: T): T {
    if (result.success) {
      return result.data;
    }
    return defaultValue;
  },
};

/**
 * Helper to avoid TypeScript's structural/`in` quirks
 */
const hasOwn = <K extends PropertyKey>(value: object, key: K): value is Record<K, unknown> =>
  // biome-ignore lint/suspicious/noPrototypeBuiltins: Using Object.prototype.hasOwnProperty.call is the safe way
  Object.prototype.hasOwnProperty.call(value, key);

/**
 * Type guard to check if a value is a Result type
 * Verifies the discriminant and the correct payload key
 */
export function isResult<T = unknown, E = unknown>(value: unknown): value is Result<T, E> {
  if (typeof value !== 'object' || value === null) return false;
  if (!hasOwn(value, 'success')) return false;

  const success = (value as Record<'success', unknown>).success;
  if (typeof success !== 'boolean') return false;

  if (success) {
    return hasOwn(value, 'data');
  }
  return hasOwn(value, 'error');
}

/**
 * Type guard to check if a value is a successful Result
 */
export function isOkResult<T = unknown, E = unknown>(
  value: unknown
): value is { success: true; data: T } {
  return isResult<T, E>(value) && value.success;
}

/**
 * Type guard to check if a value is an error Result
 */
export function isErrResult<T = unknown, E = unknown>(
  value: unknown
): value is { success: false; error: E } {
  return isResult<T, E>(value) && !value.success;
}
