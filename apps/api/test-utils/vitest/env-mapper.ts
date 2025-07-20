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
  // Map TEST_* variables to their expected names for the application code
  const mappedEnv: Record<string, string> = {};

  if (testEnv.TEST_DATABASE_URL) {
    mappedEnv.DATABASE_URL = testEnv.TEST_DATABASE_URL;
  }
  if (testEnv.TEST_API_PORT) {
    mappedEnv.API_PORT = testEnv.TEST_API_PORT;
  }
  if (testEnv.TEST_CACHE_DRIVER) {
    mappedEnv.CACHE_DRIVER = testEnv.TEST_CACHE_DRIVER;
  }

  return mappedEnv;
}
