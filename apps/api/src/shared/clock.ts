/**
 * Clock interface for time-dependent domain operations
 * @fileoverview Dependency injection for time to keep domain pure
 */

export interface Clock {
  now(): Date;
}

/**
 * Production implementation using system time
 */
export class SystemClock implements Clock {
  now(): Date {
    return new Date();
  }
}

/**
 * Singleton instance of system clock
 */
export const systemClock = new SystemClock();
