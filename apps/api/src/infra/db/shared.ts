/**
 * Shared database utilities
 * @fileoverview Common, stateless database utilities used by both production and test clients
 *
 * This module contains pure functions that can be safely reused across different database
 * configurations without side effects or environment-specific concerns.
 */

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { getRootLogger } from '../logger/root-logger';
import * as schema from './schema';
import type { DB } from './types';

/**
 * Common database connection configuration
 * Shared timeout and connection settings used across environments
 */
export const DB_CONNECTION_DEFAULTS = {
  idle_timeout: 30, // Close idle connections after 30 seconds
  max_lifetime: 60 * 60, // Recycle connections after 1 hour
  connect_timeout: 10, // 10 second connection timeout
} as const;

/**
 * Database URL validation options
 */
export interface DatabaseUrlOptions {
  /** Custom error message for missing URL */
  missingMessage?: string;
  /** Custom error message for invalid protocol */
  protocolMessage?: string;
  /** Custom error message for invalid URL format */
  formatMessage?: string;
}

/**
 * Validates PostgreSQL database URL format
 * Pure function that throws descriptive errors for invalid URLs
 *
 * @param url - Database URL to validate
 * @param options - Customization options for error messages
 * @returns The validated URL string
 * @throws Error if URL is invalid
 */
export function validateDatabaseUrl(
  url: string | undefined,
  options: DatabaseUrlOptions = {}
): string {
  const {
    missingMessage = 'DATABASE_URL environment variable is required',
    protocolMessage = 'DATABASE_URL must be a valid PostgreSQL connection string starting with postgresql:// or postgres://',
    formatMessage = 'DATABASE_URL is not a valid URL format',
  } = options;

  if (!url) {
    throw new Error(missingMessage);
  }

  if (!url.startsWith('postgresql://') && !url.startsWith('postgres://')) {
    throw new Error(protocolMessage);
  }

  try {
    new URL(url);
    return url;
  } catch (_error) {
    throw new Error(formatMessage);
  }
}

/**
 * Pool configuration builder
 * Creates postgres.js configuration with common defaults and custom overrides
 *
 * @param overrides - Custom configuration to merge with defaults
 * @returns Complete postgres.js configuration
 */
export function buildPoolConfig(
  overrides: Partial<postgres.Options<Record<string, never>>> = {}
): postgres.Options<Record<string, never>> {
  return {
    ...DB_CONNECTION_DEFAULTS,
    ...overrides,
  };
}

/**
 * Environment-specific pool configurations
 * Factory functions for common pool configurations
 */
export const PoolConfigs = {
  /**
   * Development pool configuration - small pool size
   */
  development: () => buildPoolConfig({ max: 5 }),

  /**
   * Production pool configuration - configurable size with defaults
   */
  production: (maxConnections?: number) =>
    buildPoolConfig({
      max: maxConnections ?? 20,
    }),

  /**
   * Test pool configuration - single connection for deterministic behavior
   */
  test: () =>
    buildPoolConfig({
      max: 1,
      prepare: false, // Disable prepared statements for tests
    }),
} as const;

/**
 * Database health check
 * Executes a simple query to verify database connectivity
 *
 * @param pool - postgres.js connection pool
 * @throws Error if database is unreachable
 */
export async function performHealthCheck(pool: postgres.Sql): Promise<void> {
  await pool`SELECT 1`; // Will throw if DB is unreachable
}

/**
 * Create Drizzle database instance
 * Factory function for creating configured Drizzle instances
 *
 * @param pool - postgres.js connection pool
 * @param options - Drizzle configuration options
 * @returns Configured Drizzle database instance
 */
export function createDrizzleInstance(
  pool: postgres.Sql,
  options: {
    enableLogging?: boolean;
    environment?: string;
  } = {}
): DB {
  const { enableLogging = false, environment } = options;

  return drizzle(pool, {
    logger: enableLogging || environment === 'development',
    schema,
  });
}

/**
 * Helper to safely extract string properties from an object
 */
function extractStringProperty(obj: unknown, key: string): string | undefined {
  if (obj && typeof obj === 'object' && key in obj) {
    const value = (obj as Record<string, unknown>)[key];
    return typeof value === 'string' ? value : undefined;
  }
  return undefined;
}

/**
 * Sanitize error objects to ensure no sensitive information is exposed
 * Uses a whitelist approach to only include known-safe properties
 *
 * @param error - The error to sanitize
 * @returns Sanitized error object safe for logging
 */
function sanitizeError(error: unknown): Record<string, unknown> {
  // Default safe error object
  const safeError: Record<string, unknown> = {
    message: 'Unknown error',
    type: 'unknown',
  };

  // Handle different error types
  if (error instanceof Error) {
    safeError.message = error.message;
    safeError.type = error.constructor.name;

    // Extract additional safe properties
    const safeProperties = ['code', 'constraint', 'severity'];
    for (const prop of safeProperties) {
      const value = extractStringProperty(error, prop);
      if (value) safeError[prop] = value;
    }
  } else if (typeof error === 'string') {
    safeError.message = error;
    safeError.type = 'string';
  } else if (error && typeof error === 'object') {
    const message = extractStringProperty(error, 'message');
    if (message) safeError.message = message;
    safeError.type = 'object';
  }

  return safeError;
}

/**
 * Generic shutdown handler
 * Handles connection cleanup with timeout and error handling
 *
 * @param pool - postgres.js connection pool to shutdown
 * @param options - Shutdown configuration
 */
export async function shutdownConnection(
  pool: postgres.Sql | undefined,
  options: {
    timeout?: number;
    onError?: (error: unknown) => void;
    silent?: boolean;
  } = {}
): Promise<void> {
  const { timeout = 5, onError, silent = false } = options;

  if (!pool) return;

  try {
    await pool.end({ timeout });
  } catch (error) {
    if (onError) {
      onError(error);
    } else if (!silent) {
      // Default error handling for production with sanitized logging
      const logger = getRootLogger();
      const sanitizedError = sanitizeError(error);
      logger.error(sanitizedError, '[database] Error during shutdown');
    }
    // Test environments: silent = true, no logging
  }
}

/**
 * Database connection factory result
 */
export interface DatabaseConnection {
  pool: postgres.Sql;
  db: DB;
  cleanup: () => Promise<void>;
}

/**
 * Create isolated database connection
 * Used by TestContainers and isolated test scenarios
 *
 * @param databaseUrl - Database connection URL
 * @param poolConfig - postgres.js configuration
 * @param options - Additional options
 * @returns Database connection with cleanup function
 */
export function createIsolatedConnection(
  databaseUrl: string,
  poolConfig: postgres.Options<Record<string, never>>,
  options: {
    enableLogging?: boolean;
    environment?: string;
    silentCleanup?: boolean;
  } = {}
): DatabaseConnection {
  const { enableLogging = false, environment, silentCleanup = true } = options;

  // Validate URL first
  const validUrl = validateDatabaseUrl(databaseUrl);

  // Create connection
  const pool = postgres(validUrl, poolConfig);
  const db = createDrizzleInstance(pool, { enableLogging, environment });

  // Create cleanup function
  const cleanup = () => shutdownConnection(pool, { silent: silentCleanup });

  return { pool, db, cleanup };
}
