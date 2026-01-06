import { defineConfig, devices } from '@playwright/test';

if (!process.env.BASE_URL) {
  throw new Error('BASE_URL environment variable is required. Please set it before running tests.');
}

if (!process.env.SEARCH_KEYWORD) {
  throw new Error('SEARCH_KEYWORD environment variable is required. Please set it before running tests.');
}

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: process.env.BASE_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    acceptDownloads: true, // Allow downloads to be saved to the filesystem
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});

