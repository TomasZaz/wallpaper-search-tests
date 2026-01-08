import { defineConfig, devices } from '@playwright/test';

if (!process.env.BASE_URL) {
  throw new Error('BASE_URL environment variable is required. Please set it before running tests.');
}

if (!process.env.SEARCH_KEYWORD) {
  throw new Error('SEARCH_KEYWORD environment variable is required. Please set it before running tests.');
}

export default defineConfig({
  testDir: './tests', // Directory where test files are located
  fullyParallel: true, // Run tests in parallel across all workers
  forbidOnly: !!process.env.CI, // Prevent test.only() from running in CI (ensures all tests run)
  retries: process.env.CI ? 2 : 0, // Retry failed tests 2 times in CI, 0 times locally
  workers: process.env.CI ? 1 : undefined, // Use 1 worker in CI, auto-detect locally (runs tests in parallel)
  timeout: process.env.CI ? 60000 : 30000, // Increase timeout to 60s in CI (slower runners), 30s locally
  reporter: 'html', // Generate HTML test report
  use: {
    baseURL: process.env.BASE_URL, // Base URL for all tests (required environment variable)
    trace: 'on-first-retry', // Record trace only when retrying a failed test (for debugging)
    screenshot: 'only-on-failure', // Take screenshots only when tests fail
    video: 'retain-on-failure', // Record video only for failed tests
    acceptDownloads: true, // Allow browser to save downloaded files to the filesystem
    actionTimeout: process.env.CI ? 30000 : 10000, // Increase action timeout in CI (slower runners)
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    // Uncomment to run tests in additional browsers:
    // {
    //   name: 'firefox',
    //   use: { ...devices['Desktop Firefox'] },
    // },
    // {
    //   name: 'Safari',
    //   use: { ...devices['Desktop Safari'] },
    // },
    // {
    //   name: 'Microsoft Edge',
    //   use: { ...devices['Desktop Edge'] },
    // },
  ],
});

