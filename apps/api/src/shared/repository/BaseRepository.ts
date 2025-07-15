/**
 * Base repository class with logging support
 * @fileoverview Provides common functionality for all repositories
 */

import type { LoggerPort } from '../logger/LoggerPort';

/**
 * Base repository class that all repositories can extend
 * Provides access to a domain logger through the LoggerPort interface
 */
export abstract class BaseRepository {
  constructor(protected readonly logger: LoggerPort) {}

  /**
   * Helper method to safely extract error message
   */
  protected getErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }
    return String(error);
  }

  /**
   * Helper method to safely extract error details
   */
  protected getErrorDetails(error: unknown): Record<string, unknown> {
    if (error instanceof Error) {
      return {
        message: error.message,
        name: error.name,
        stack: error.stack,
      };
    }
    return {
      error: String(error),
    };
  }
}
