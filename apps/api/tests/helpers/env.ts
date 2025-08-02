/**
 * Test environment mapping utilities
 */

// Map TEST_* prefixed environment variables to their runtime equivalents
const TEST_ENV_MAPPING: Record<string, string> = {
  TEST_DATABASE_URL: 'DATABASE_URL',
  TEST_API_PORT: 'API_PORT',
  TEST_CACHE_DRIVER: 'CACHE_DRIVER',
};

/**
 * Maps TEST_* prefixed environment variables to their runtime equivalents
 * This allows tests to use isolated environment variables that don't
 * conflict with development environment settings
 *
 * @param testEnv - Record of TEST_* prefixed environment variables
 * @returns Mapped environment variables without TEST_ prefix
 */
export function mapTestEnvironmentVariables(
  testEnv: Record<string, string>
): Record<string, string> {
  const mappedEnv: Record<string, string> = {};

  // Iterate through the mapping configuration
  for (const [testKey, runtimeKey] of Object.entries(TEST_ENV_MAPPING)) {
    if (testEnv[testKey]) {
      mappedEnv[runtimeKey] = testEnv[testKey];
    }
  }

  return mappedEnv;
}
