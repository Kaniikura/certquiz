/**
 * Configuration mapping for test environment variables
 * Maps TEST_* prefixed variables to their runtime equivalents
 */
const TEST_ENV_MAPPING: Record<string, string> = {
  TEST_DATABASE_URL: 'DATABASE_URL',
  TEST_API_PORT: 'API_PORT',
  TEST_CACHE_DRIVER: 'CACHE_DRIVER',
};

/**
 * Maps TEST_* prefixed environment variables to their expected names
 *
 * When using Vite's loadEnv with a 'TEST_' prefix, it only loads variables
 * that start with TEST_ but does NOT strip the prefix. This function maps
 * the TEST_* variables to their expected names.
 *
 * @param testEnv - The environment variables loaded by loadEnv with TEST_ prefix
 * @returns Mapped environment variables ready to be applied to process.env
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
