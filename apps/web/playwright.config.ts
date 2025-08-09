import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright configuration for CertQuiz E2E tests
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  // Look for test files in the tests/e2e directory
  testDir: './tests/e2e',

  // Run tests in files in parallel
  fullyParallel: true,

  // Fail the build on CI if you accidentally left test.only in the source code
  forbidOnly: !!process.env.CI,

  // Retry failed tests once
  retries: process.env.CI ? 2 : 1,

  // Limit parallel workers on CI to prevent resource exhaustion
  workers: process.env.CI ? 1 : undefined,

  // Reporter configuration - HTML for local, line for CI
  reporter: process.env.CI ? 'line' : [['html', { open: 'never' }]],

  // Test timeout - 30 seconds
  timeout: 30 * 1000,

  // Shared settings for all projects
  use: {
    // Base URL for all navigation
    baseURL: process.env.PUBLIC_BASE_URL || 'http://localhost:5173',

    // Collect trace on first retry for debugging
    trace: 'on-first-retry',

    // Take screenshot on failure
    screenshot: 'only-on-failure',

    // Video on first retry (disabled in CI to save resources)
    video: process.env.CI ? 'off' : 'on-first-retry',

    // Extra HTTP headers for API requests
    extraHTTPHeaders: {
      // API URL for tests that directly call the API
      'X-API-URL': process.env.PLAYWRIGHT_API_URL || 'http://localhost:4000',
    },
  },

  // Configure projects for different browsers - starting with just Chromium
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },

    // Can be added later for cross-browser testing:
    // {
    //   name: 'firefox',
    //   use: { ...devices['Desktop Firefox'] },
    // },
    // {
    //   name: 'webkit',
    //   use: { ...devices['Desktop Safari'] },
    // },
  ],

  // Run local dev server before starting tests (only in local development)
  // In CI, servers are started separately in the workflow
  webServer: process.env.CI
    ? undefined
    : {
        command: 'bun run dev',
        url: 'http://localhost:5173',
        reuseExistingServer: true,
        stdout: 'pipe',
        stderr: 'pipe',
        timeout: 120 * 1000, // 2 minutes to start
      },
});
