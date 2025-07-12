/**
 * ID generation interface and implementations
 * @fileoverview Dependency injection for ID generation to keep domain pure
 */

export interface IdGenerator {
  generate(): string;
}

/**
 * Production implementation using crypto.randomUUID()
 */
export class CryptoIdGenerator implements IdGenerator {
  generate(): string {
    return crypto.randomUUID();
  }
}

/**
 * Test implementation with predictable IDs
 */
export class TestIdGenerator implements IdGenerator {
  private counter = 1;

  generate(): string {
    return `test-id-${this.counter++}`;
  }

  reset(): void {
    this.counter = 1;
  }

  getCurrentCounter(): number {
    return this.counter;
  }
}

// Default implementation for convenience
const defaultGenerator = new CryptoIdGenerator();

export function generateId(): string {
  return defaultGenerator.generate();
}
