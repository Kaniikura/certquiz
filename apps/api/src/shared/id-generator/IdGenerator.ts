/**
 * ID Generator Service Interface
 * @fileoverview Abstraction for generating unique identifiers
 */

/**
 * Interface for generating unique identifiers
 * Abstracts the implementation details of ID generation
 * to allow for different strategies (crypto, uuid libraries, etc.)
 */
export interface IdGenerator {
  /**
   * Generate a unique identifier
   * @returns A string-based unique identifier
   */
  generate(): string;
}
