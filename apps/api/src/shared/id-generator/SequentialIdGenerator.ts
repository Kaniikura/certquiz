/**
 * Sequential ID Generator Implementation
 * @fileoverview Test-friendly implementation for predictable ID generation
 */

import type { IdGenerator } from './IdGenerator';

/**
 * Sequential ID generator for testing purposes
 * Generates predictable sequential IDs with optional prefix
 *
 * Testing Benefits:
 * - Predictable ID generation for test assertions
 * - Deterministic behavior for reproducible tests
 * - Optional prefix for different entity types
 * - Counter can be reset for clean test setup
 *
 * WARNING: This should NEVER be used in production environments
 * as it generates predictable, sequential IDs without security.
 */
export class SequentialIdGenerator implements IdGenerator {
  private counter = 1;

  constructor(private readonly prefix: string = 'test') {}

  /**
   * Generate a sequential ID with format: prefix-000001
   * @returns A predictable sequential ID string
   */
  generate(): string {
    const id = `${this.prefix}-${this.counter.toString().padStart(6, '0')}`;
    this.counter++;
    return id;
  }

  /**
   * Reset the counter for clean test setup
   * @param startValue Starting value for the counter (default: 1)
   */
  reset(startValue = 1): void {
    this.counter = startValue;
  }

  /**
   * Get the current counter value
   * @returns Current counter value
   */
  getCurrentCounter(): number {
    return this.counter;
  }
}
