import { defineConfig, devices } from '@playwright/test';
import path from 'node:path';

const desktopProjects = [
  {
    name: 'chromium',
    use: { ...devices['Desktop Chrome'] },
    testIgnore: /responsive\.spec\.ts/,
  },
  ...(process.env.E2E_ALL_BROWSERS === 'true'
    ? [
        {
          name: 'firefox',
          use: { ...devices['Desktop Firefox'] },
          testIgnore: /responsive\.spec\.ts/,
        },
        {
          name: 'webkit',
          use: { ...devices['Desktop Safari'] },
          testIgnore: /responsive\.spec\.ts/,
        },
      ]
    : []),
];

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  testDir: './e2e',
  /* Stateful GPMS workflows share one test database, so keep local runs deterministic. */
  fullyParallel: false,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : 1,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: [
    ['list'],
    ['html', { open: 'never', outputFolder: 'playwright-report' }],
  ],
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('/')`. */
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:3000',

    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 20_000,
    navigationTimeout: 30_000,
  },

  /* Configure projects for major browsers */
  projects: [
    ...desktopProjects,

    /* Test against mobile viewports. */
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
      testMatch: /responsive\.spec\.ts/,
    },
    {
      name: 'Mobile Safari',
      use: { ...devices['iPhone 12'] },
      testMatch: /responsive\.spec\.ts/,
    },
  ],

  /* Run your local dev server before starting the tests */
  webServer: [
    {
      command: 'npm run dev',
      cwd: path.resolve(__dirname, '../GraduationProjectBackend'),
      url: 'http://127.0.0.1:4000/health',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: {
        SMTP_HOST: '',
        SMTP_PORT: '0',
        SMTP_USER: '',
        SMTP_PASS: '',
      },
    },
    {
      command: 'npm run dev',
      cwd: __dirname,
      url: 'http://127.0.0.1:3000',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: {
        NEXT_PUBLIC_API_BASE_URL: process.env.NEXT_PUBLIC_API_BASE_URL ?? '/api/v1',
        BACKEND_URL: process.env.BACKEND_URL ?? 'http://127.0.0.1:4000',
        GOOGLE_GENERATIVE_AI_API_KEY: '',
        GOOGLE_API_KEY: '',
        OPENAI_API_KEY: '',
      },
    },
  ],
});
