import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  expect: { timeout: 8_000 },
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['line'], ['html', { outputFolder: '../artifacts/playwright-report', open: 'never' }]] : 'line',
  use: { baseURL: 'http://127.0.0.1:3000', trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  projects: [
    { name: 'desktop-chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'narrow-chromium', use: { ...devices['Pixel 5'] } },
  ],
  webServer: [
    {
      command: 'pnpm --dir ../server start:combined',
      url: 'http://127.0.0.1:5000/api/health/combined/ready',
      timeout: 60_000,
      reuseExistingServer: !process.env.CI,
      env: {
        ...process.env,
        NODE_ENV: 'test',
        PORT: '5000',
        METRICS_PORT: '5001',
        CLIENT_URL: 'http://127.0.0.1:3000',
        CORS_ORIGIN: 'http://127.0.0.1:3000',
      },
    },
    {
      command: 'pnpm start',
      url: 'http://127.0.0.1:3000',
      timeout: 60_000,
      reuseExistingServer: !process.env.CI,
      env: { ...process.env, NODE_ENV: 'production', PORT: '3000' },
    },
  ],
});
