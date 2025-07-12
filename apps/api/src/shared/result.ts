/**
 * Result type for functional error handling
 * Inspired by Rust's Result<T, E> type
 */

export type Result<T, E = Error> = { success: true; data: T } | { success: false; error: E };

function okOverload<T>(data: T): Result<T, never>;
function okOverload(): Result<void, never>;
function okOverload<T>(data?: T): Result<T | undefined, never> {
  return { success: true, data: data as T | undefined };
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
