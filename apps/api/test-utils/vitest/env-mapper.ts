/**
 * Maps TEST_* prefixed environment variables to their expected names
 *
 * When using Vite's loadEnv with a 'TEST_' prefix, it only loads variables
 * that start with TEST_ but does NOT strip the prefix. This function maps
 * the TEST_* variables to their expected names in process.env.
 *
 * @param testEnv - The environment variables loaded by loadEnv with TEST_ prefix
 */
export function mapTestEnvironmentVariables(testEnv: Record<string, string>): void {
  // Map TEST_* variables to their expected names for the application code
  if (testEnv.TEST_DATABASE_URL) {
    process.env.DATABASE_URL = testEnv.TEST_DATABASE_URL;
  }
  if (testEnv.TEST_API_PORT) {
    process.env.API_PORT = testEnv.TEST_API_PORT;
  }
  if (testEnv.TEST_CACHE_DRIVER) {
    process.env.CACHE_DRIVER = testEnv.TEST_CACHE_DRIVER;
  }
}
