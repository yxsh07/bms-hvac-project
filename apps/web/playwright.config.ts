import { defineConfig, devices } from '@playwright/test';

const checklist = process.env.E2E_CHECKLIST === '1';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: !checklist,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: checklist || process.env.CI ? 1 : undefined,
  reporter: checklist ? [['list'], ['./e2e/support/checklist-reporter.ts']] : 'html',
  use: {
    baseURL: process.env.DEMO_URL ?? 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure'
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] }
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] }
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] }
    },
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] }
    },
    {
      name: 'Mobile Safari',
      use: { ...devices['iPhone 12'] }
    },
    {
      name: 'Tablet Landscape',
      use: { ...devices['iPad Pro 11'], viewport: { width: 1180, height: 820 } }
    },
    {
      name: 'Tablet Portrait',
      use: { ...devices['iPad Pro 11'], viewport: { width: 820, height: 1180 } }
    }
  ],
  webServer: process.env.DEMO_URL ? undefined : {
    command: 'pnpm dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 120000
  }
});
