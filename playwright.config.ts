import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end suite.
 *
 * Runs against a real production build in a real browser, because the
 * failures that matter on event day — a page that throws, a search that
 * does not filter, a layout that overflows on a phone — are invisible to
 * unit tests.
 *
 * Auth is deliberately NOT bypassed. Protected routes are asserted to
 * redirect, which is itself the behaviour we most need to hold. Form
 * logic behind auth is covered by the component tests instead, so no
 * production auth escape hatch has to exist for testing.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: 2,
  reporter: [['list']],
  timeout: 30_000,
  expect: { timeout: 10_000 },

  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://127.0.0.1:3999',
    trace: 'retain-on-failure',
    launchOptions: { executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' },
  },

  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],

  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: 'npx next start -p 3999',
        url: 'http://127.0.0.1:3999',
        reuseExistingServer: true,
        timeout: 120_000,
      },
});
