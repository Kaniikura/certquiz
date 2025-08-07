import { expect, test } from '@playwright/test';

test.describe('CertQuiz App', () => {
  test('should load the homepage', async ({ page }) => {
    // Navigate to the homepage
    await page.goto('/');

    // Wait for the page to be fully loaded
    await page.waitForLoadState('networkidle');

    // Check that the page has loaded (basic smoke test)
    // The title or a main heading should be visible
    await expect(page).toHaveTitle(/CertQuiz/i);
  });

  test('should display main navigation elements', async ({ page }) => {
    await page.goto('/');

    // Check for main structural elements
    // These selectors may need adjustment based on actual app structure
    const mainContent = page.locator('main, [role="main"], #app');
    await expect(mainContent).toBeVisible();
  });

  test('API health check should be accessible', async ({ request }) => {
    // Test that the API is running and accessible
    // In CI, API runs on port 4001; locally on 4000
    const apiUrl = process.env.PLAYWRIGHT_API_URL || 'http://localhost:4000';
    const response = await request.get(`${apiUrl}/health`);

    expect(response.ok()).toBeTruthy();
    expect(response.status()).toBe(200);

    const healthData = await response.json();
    expect(healthData).toHaveProperty('status');
    expect(healthData.status).toBe('healthy');
  });

  test('should handle navigation to login page', async ({ page }) => {
    await page.goto('/');

    // Look for a login link or button (adjust selector as needed)
    const loginLink = page
      .locator('a[href*="login"], button:has-text("Login"), a:has-text("Sign in")')
      .first();

    // If login link exists, test navigation
    if (await loginLink.isVisible()) {
      await loginLink.click();

      // Wait for navigation
      await page.waitForLoadState('networkidle');

      // Verify we're on a login-related page
      const url = page.url();
      expect(url).toMatch(/login|signin|auth/i);
    }
  });
});
