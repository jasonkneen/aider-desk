import { defineConfig, PlaywrightTestConfig } from '@playwright/test';

/**
 * See https://playwright.dev/docs/test-configuration.
 */
const config: PlaywrightTestConfig = {
  // Directory where the tests are located
  testDir: 'e2e', // Standard directory for Playwright E2E tests

  /* Maximum time one test can run for. */
  timeout: 60 * 1000, // 60 seconds

  expect: {
    /**
     * Maximum time expect() should wait for the condition to be met.
     * For example in `await expect(locator).toHaveText();`
     */
    timeout: 10 * 1000, // 10 seconds
  },

  /* Run tests in files in parallel */
  fullyParallel: true,

  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,

  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,

  /* Opt out of parallel tests on CI. */
  workers: process.env.CI ? 1 : undefined, // Adjust as needed, 1 worker on CI is common

  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: 'html',

  use: {
    /* Base URL to use in actions like `await page.goto('/')`. */
    // baseURL: 'http://localhost:3000', // Not typically used for Electron apps

    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: 'on-first-retry',

    // Note: Viewport settings here might be overridden by Electron window sizing in tests.
    // viewport: { width: 1280, height: 720 }, // Example viewport
  },

  /* Configure projects for major browsers */
  // Since we are testing an Electron app, browser-specific projects are not relevant.
  // We define a single project for Electron.
  // The actual Electron app launching and context creation will be handled
  // within the test files using Playwright's Electron API (`import { _electron } from 'playwright'`).
  projects: [
    {
      name: 'electron',
      // Test files in this project will use Playwright's Electron functionality.
      // No specific browserName or device is needed here as it's not a web test.
    },
  ],

  /* Folder for test artifacts such as screenshots, videos, traces, etc. */
  // outputDir: 'test-results/',

  // Optional: A global setup script can be used to build the Electron app
  // or perform other setup tasks before tests run.
  // globalSetup: require.resolve('./path/to/globalSetup.ts'),

  // Optional: A global teardown script.
  // globalTeardown: require.resolve('./path/to/globalTeardown.ts'),
};

export default config;
