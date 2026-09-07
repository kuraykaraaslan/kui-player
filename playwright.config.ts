import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end runs against a real browser, driving the harness page in
 * tests/e2e/app. Desktop projects cover the pointer/keyboard paths; the mobile
 * project exercises the touch gestures, which have no desktop equivalent.
 *
 * Locally, `pnpm test:e2e` runs whichever browsers are installed
 * (`npx playwright install`); CI installs all three.
 */
export default defineConfig({
  testDir: './tests/e2e',
  testMatch: '**/*.spec.ts',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : [['list']],
  use: {
    baseURL: 'http://localhost:5174',
    trace: 'on-first-retry',
    video: 'off',
  },
  projects: [
    // Touch gestures only exist on a coarse pointer, so the desktop projects
    // skip that spec and the mobile project runs nothing else.
    { name: 'chromium', use: { ...devices['Desktop Chrome'] }, testIgnore: '**/gestures.spec.ts' },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] }, testIgnore: '**/gestures.spec.ts' },
    { name: 'webkit', use: { ...devices['Desktop Safari'] }, testIgnore: '**/gestures.spec.ts' },
    { name: 'mobile', use: { ...devices['Pixel 5'] }, testMatch: '**/gestures.spec.ts' },
  ],
  webServer: {
    command: 'npx vite --config vite.config.e2e.ts',
    url: 'http://localhost:5174',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
