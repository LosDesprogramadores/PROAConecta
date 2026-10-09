import { defineConfig, devices } from '@playwright/test';

// The stack is started outside Playwright (docker-compose.e2e.yml); this file only points at it.
const baseURL = process.env.E2E_BASE_URL ?? 'http://localhost:14200';

export default defineConfig({
  testDir: './tests',
  outputDir: './test-results',
  // Tests share one seeded database; they are written to be independent, but a single stack is small
  fullyParallel: false,
  workers: process.env.CI ? 1 : 2,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  // A test that only passes on retry is flaky: it fails the run in CI instead of hiding behind the retry
  failOnFlakyTests: !!process.env.CI,
  timeout: 30_000,
  expect: { timeout: 10_000 },
  reporter: process.env.CI
    ? [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]]
    : [['list']],
  use: {
    baseURL,
    locale: 'es-AR',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    // Logs in once per role and stores the session (see auth.setup.ts)
    { name: 'setup', testMatch: /auth\.setup\.ts/ },
    {
      name: 'chromium',
      testMatch: /tests\/.*\.spec\.ts/,
      use: { ...devices['Desktop Chrome'] },
      dependencies: ['setup'],
    },
  ],
});
