import { defineConfig, devices } from '@playwright/test';

const PORT = Number(process.env.PORT) || 3000;
const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`;
const isCI = !!process.env.CI;

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 1 : 0,
  workers: isCI ? 2 : undefined,
  reporter: isCI
    ? [['list'], ['html', { open: 'never' }], ['junit', { outputFile: 'test-results/junit.xml' }]]
    : [['list'], ['html', { open: 'never' }]],

  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects: [
    // Logs in once through the API and saves the session for the UI projects.
    { name: 'setup', testMatch: /setup\/.*\.setup\.ts/ },

    {
      name: 'api',
      testMatch: /api\/.*\.spec\.ts/,
    },
    {
      name: 'chromium',
      testMatch: [/ui\/.*\.spec\.ts/, /seed\.spec\.ts/],
      dependencies: ['setup'],
      use: { ...devices['Desktop Chrome'], storageState: '.auth/user.json' },
    },
    {
      name: 'mobile',
      testMatch: /ui\/.*\.spec\.ts/,
      grep: /@mobile/,
      dependencies: ['setup'],
      use: { ...devices['Pixel 7'], storageState: '.auth/user.json' },
    },
  ],

  // Starts the demo app automatically. Point BASE_URL at another environment to skip this.
  webServer: process.env.BASE_URL
    ? undefined
    : {
        command: 'node app/server.js',
        url: `${BASE_URL}/api/health`,
        reuseExistingServer: !isCI,
        env: { PORT: String(PORT) },
      },
});
