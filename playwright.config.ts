import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright configuration for Co-do visual and accessibility testing
 *
 * This configuration sets up:
 * - Visual regression testing with screenshots
 * - Accessibility testing with axe-core
 * - Chrome-focused testing (primary target browser)
 */
export default defineConfig({
  // Test directory
  testDir: './tests',

  // Maximum time one test can run
  timeout: 30000,

  // Run tests in files in parallel
  fullyParallel: true,

  // Fail the build on CI if you accidentally left test.only in the source code
  forbidOnly: !!process.env.CI,

  // Retry on CI only
  retries: process.env.CI ? 2 : 0,

  // Reporter to use
  reporter: process.env.CI
    ? [['html'], ['github']]
    : [['html'], ['list']],

  // Shared settings for all projects
  use: {
    // Base URL to use in actions like `await page.goto('/')`
    baseURL: 'http://localhost:3000/',

    // Collect trace when retrying the failed test
    trace: 'on-first-retry',

    // Screenshot on failure
    screenshot: 'only-on-failure',

    // Video on failure
    video: 'retain-on-failure',
  },

  // Configure projects for major browsers
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        // Enable Chrome-specific features
        viewport: { width: 1280, height: 720 },
      },
    },

    // Mobile Chrome for responsive testing
    {
      name: 'mobile-chrome',
      use: {
        ...devices['Pixel 5'],
      },
    },
  ],

  // Run local dev server before starting the tests
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000/',
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
});
