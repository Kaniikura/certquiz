/**
 * Environment configuration using Zod for validation and type safety
 *
 * This centralized configuration ensures all environment variables are:
 * - Validated at startup
 * - Type-safe throughout the application
 * - Have sensible defaults where appropriate
 */

import { z } from 'zod';

/**
 * Environment schema definition
 * Defines all environment variables used by the application
 */
const envSchema = z.object({
  // Node environment
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  // Server configuration
  API_PORT: z.coerce.number().positive().default(4000),

  // Database
  DATABASE_URL: z.string().url().optional(),
  DATABASE_URL_TEST: z.string().url().optional(),

  // Auth/KeyCloak
  KEYCLOAK_URL: z.string().url().default('http://localhost:8080'),
  KEYCLOAK_REALM: z.string().default('certquiz'),
  ROLE_MAPPING_JSON: z.string().optional(),

  // Frontend
  FRONTEND_URL: z.string().url().default('http://localhost:5173'),

  // Logging
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),

  // Testing
  CI: z.literal('true').optional(),
  VITEST_WORKER_ID: z.string().optional(),
  TEST_TYPE: z.string().optional(),
  TESTCONTAINERS_REUSE_ENABLE: z.string().optional(),
  TESTCONTAINERS_RYUK_DISABLED: z.string().optional(),
});

/**
 * Infer the type of the environment from the schema
 */
export type Env = z.infer<typeof envSchema>;

/**
 * Parse and validate environment variables
 * This will throw an error if required variables are missing or invalid
 */
export const env = envSchema.parse(process.env);

/**
 * Environment type for DI container
 */
export type Environment = 'test' | 'development' | 'production';

/**
 * Check if the application is running in production
 */
export function isProduction(): boolean {
  return env.NODE_ENV === 'production';
}

/**
 * Check if the application is running in development
 */
export function isDevelopment(): boolean {
  return env.NODE_ENV === 'development';
}

/**
 * Check if the application is running in test environment
 */
export function isTest(): boolean {
  return env.NODE_ENV === 'test';
}
